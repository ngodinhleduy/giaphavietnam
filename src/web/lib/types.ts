export type Gender = 'male' | 'female';

export interface MemberBrief {
  id: number;
  full_name: string;
  alias?: string | null;
  gender: Gender;
  generation: number | null;
  father_id: number | null;
  mother_id: number | null;
  birth_order: number | null;
  is_blood: number;
  is_deceased: number;
  birth_date: string | null;
  death_date: string | null;
  branch?: string | null;
  photo_file_id: number | null;
  is_hidden?: number;
  title_role?: string | null;
  child_type?: 'biological' | 'adopted' | 'out_of_wedlock';
}

export const CHILD_TYPE_LABEL = { biological: 'Con ruột', adopted: 'Con nuôi', out_of_wedlock: 'Con ngoài giá thú' } as const;

export interface Marriage {
  id: number;
  husband_id: number;
  wife_id: number;
  order_no: number;
}

export interface MemberDetail extends MemberBrief {
  death_lunar_day: number | null;
  death_lunar_month: number | null;
  burial_place: string | null;
  hometown: string | null;
  occupation: string | null;
  bio: string | null;
  father: MemberBrief | null;
  mother: MemberBrief | null;
  children: MemberBrief[];
  spouses: (MemberBrief & { order_no: number; marriage_id: number })[];
}

export interface Site {
  site_name: string;
  site_tagline: string;
  intro: string;
  address: string;
  map_embed: string;
  contact: string;
  locked: boolean;
  unlocked: boolean;
  menu?: { to: string; label: string; external: boolean }[];
  template?: string;
  contact_intro?: string;
  contact_people?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_zalo?: string;
  contact_facebook?: string;
  contact_form?: string;
  categories: { id: number; slug: string; name: string }[];
  logo_file_id: number | null;
  banner_file_id: number | null;
  intro_image_file_id?: number | null;
  favicon_file_id?: number | null;
  foreword?: string;
  tree_lines?: string;
}

export interface ArticleBrief {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  cover_file_id: number | null;
  created_at: string;
  category_slug: string | null;
  category_name: string | null;
}

export interface UpcomingEvent {
  id: number | string;
  kind: 'event' | 'gio';
  member_id?: number;
  title: string;
  description?: string | null;
  calendar: 'solar' | 'lunar';
  day: number;
  month: number;
  location?: string | null;
  next_date: string;
}
