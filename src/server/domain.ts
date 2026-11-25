// Gắn tên miền riêng cho trang chạy trên Cloudflare Workers.
// Luồng: tạo vùng DNS (zone) trên Cloudflare -> người dùng đổi nameserver ở nơi mua tên miền -> zone hoạt động -> gắn tên miền vào Worker.
// Token Cloudflare chỉ nằm ở máy chủ (secret của Worker), không bao giờ gửi về trình duyệt.

export type CloudflareConfig = { token: string; accountId: string; worker: string };
export type DomainState = {
  /** none: chưa có tên miền. nameservers: chờ đổi nameserver. attaching: zone đã hoạt động, chưa gắn đủ. active: đã gắn. */
  stage: 'none' | 'nameservers' | 'attaching' | 'active';
  domain: string | null;
  zoneId: string | null;
  nameServers: string[];
  oldNameServers: string[];
  hostnames: { hostname: string; attached: boolean }[];
};

export class DomainError extends Error {}

const API = 'https://api.cloudflare.com/client/v4';
type Fetch = typeof fetch;

/** Chuẩn hóa thứ người dùng gõ: bỏ https://, đường dẫn, www. Trả null nếu không phải tên miền hợp lệ. */
export function cleanDomain(input: unknown): string | null {
  let d = String(input ?? '').trim().toLowerCase();
  d = d.replace(/^[a-z]+:\/\//, '').replace(/[/?#].*$/, '').replace(/:\d+$/, '').replace(/\.$/, '').replace(/^www\./, '');
  if (d.length > 253 || !/^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/.test(d)) return null;
  if (/\.(workers\.dev|pages\.dev)$/.test(d)) return null;
  return d;
}

export function cloudflareDomains(cfg: CloudflareConfig, fetchFn: Fetch = fetch) {
  const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    let res: Response;
    try {
      res = await fetchFn(`${API}${path}`, {
        method,
        headers: { authorization: `Bearer ${cfg.token}`, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new DomainError('Không kết nối được tới Cloudflare. Thử lại sau ít phút.');
    }
    const j = (await res.json().catch(() => null)) as any;
    if (!res.ok || !j?.success) {
      const e = j?.errors?.[0];
      const err = new DomainError(explain(res.status, e?.code, e?.message));
      (err as any).code = e?.code;
      throw err;
    }
    return j.result as T;
  };

  const hostnamesOf = (domain: string) => [domain, `www.${domain}`];

  async function attached(zoneId: string) {
    const list = await call<any[]>('GET', `/accounts/${cfg.accountId}/workers/domains?zone_id=${zoneId}`);
    return list.filter((d) => d.service === cfg.worker);
  }

  async function state(domain: string | null, zoneId: string | null): Promise<DomainState> {
    if (!domain || !zoneId) return { stage: 'none', domain: null, zoneId: null, nameServers: [], oldNameServers: [], hostnames: [] };
    const z = await call<any>('GET', `/zones/${zoneId}`);
    const base = { domain, zoneId, nameServers: z.name_servers ?? [], oldNameServers: z.original_name_servers ?? [] };
    if (z.status !== 'active')
      return { ...base, stage: 'nameservers', hostnames: hostnamesOf(domain).map((hostname) => ({ hostname, attached: false })) };
    const have = new Set((await attached(zoneId)).map((d) => d.hostname));
    const hostnames = hostnamesOf(domain).map((hostname) => ({ hostname, attached: have.has(hostname) }));
    return { ...base, stage: hostnames.every((h) => h.attached) ? 'active' : 'attaching', hostnames };
  }

  return {
    /** Token còn dùng được không. */
    async verify() {
      const r = await call<{ status: string }>('GET', '/user/tokens/verify');
      if (r.status !== 'active') throw new DomainError('API token của Cloudflare đã bị tắt hoặc hết hạn.');
    },

    state,

    /** Tạo zone cho tên miền, hoặc dùng lại zone đã có trong tài khoản. */
    async add(domain: string): Promise<DomainState> {
      let zone: any;
      try {
        zone = await call<any>('POST', '/zones', { name: domain, account: { id: cfg.accountId }, type: 'full' });
      } catch (e: any) {
        if (e.code !== 1061) throw e; // 1061: zone đã tồn tại
        const found = await call<any[]>('GET', `/zones?name=${encodeURIComponent(domain)}&account.id=${cfg.accountId}`);
        if (!found.length) throw new DomainError('Tên miền này đang nằm trong một tài khoản Cloudflare khác. Gỡ nó khỏi tài khoản đó trước.');
        zone = found[0];
      }
      return state(domain, zone.id);
    },

    /** Nhờ Cloudflare kiểm tra lại nameserver; nếu zone đã hoạt động thì gắn tên miền vào Worker. */
    async check(domain: string, zoneId: string): Promise<DomainState> {
      let s = await state(domain, zoneId);
      if (s.stage === 'nameservers') {
        // Cloudflare giới hạn số lần yêu cầu kiểm tra; bị từ chối cũng không sao vì nó vẫn tự kiểm tra định kỳ
        await call('PUT', `/zones/${zoneId}/activation_check`).catch(() => {});
        s = await state(domain, zoneId);
      }
      if (s.stage === 'attaching') {
        for (const h of s.hostnames.filter((x) => !x.attached))
          await call('PUT', `/accounts/${cfg.accountId}/workers/domains`, {
            hostname: h.hostname, service: cfg.worker, environment: 'production', zone_id: zoneId,
            // Bản ghi cũ trỏ về nơi chạy trang trước đây (nếu Cloudflare đã chép sang) được thay bằng bản ghi của Worker
            override_existing_dns_record: true,
          });
        s = await state(domain, zoneId);
      }
      return s;
    },

    /** Gỡ tên miền khỏi Worker. Zone và các bản ghi DNS khác được giữ nguyên trên Cloudflare. */
    async remove(zoneId: string) {
      for (const d of await attached(zoneId)) await call('DELETE', `/accounts/${cfg.accountId}/workers/domains/${d.id}`);
    },
  };
}

function explain(status: number, code?: number, message?: string): string {
  const raw = message ? ` (Cloudflare: ${message})` : '';
  if (status === 401 || code === 10000 || code === 9109) return `API token của Cloudflare không hợp lệ hoặc thiếu quyền.${raw}`;
  if (status === 403) return `API token của Cloudflare thiếu quyền cho thao tác này.${raw}`;
  if (code === 1049 || code === 1099) return `Cloudflare không nhận tên miền này. Hãy nhập tên miền gốc bạn đã mua, ví dụ hongo.vn, không nhập tên miền con.${raw}`;
  if (code === 1097 || code === 1105) return `Tên miền này đang bị tạm khóa trên Cloudflare, thử lại sau.${raw}`;
  if (code === 1118) return `Tài khoản Cloudflare đã đạt giới hạn số tên miền.${raw}`;
  if (status === 429) return 'Cloudflare đang giới hạn tần suất. Chờ vài phút rồi thử lại.';
  return `Cloudflare báo lỗi.${raw || ` (mã ${status})`}`;
}
