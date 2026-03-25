export type Gender = "male" | "female" | "other" | "unknown";

export interface TreeMember {
  id: string;
  tree_id: string;
  first_name: string;
  last_name: string | null;
  maiden_name: string | null;
  gender: Gender | null;
  date_of_birth: string | null;
  date_of_death: string | null;
  birth_year: number | null;
  birth_month: number | null;
  birth_day: number | null;
  death_year: number | null;
  death_month: number | null;
  death_day: number | null;
  birth_place: string | null;
  death_place: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_deceased: boolean;
  position_x: number | null;
  position_y: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface MemberFormData {
  first_name: string;
  last_name?: string;
  maiden_name?: string;
  gender?: Gender;
  date_of_birth?: string;
  date_of_death?: string;
  birth_year?: number;
  birth_month?: number;
  birth_day?: number;
  death_year?: number;
  death_month?: number;
  death_day?: number;
  birth_place?: string;
  death_place?: string;
  bio?: string;
  is_deceased?: boolean;
}
