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
  birth_place?: string;
  death_place?: string;
  bio?: string;
  is_deceased?: boolean;
}
