export type Status = 'verified' | 'observed' | 'hypothesis' | 'unknown' | 'contradiction';

export interface Evidence { text: string; status: Status; points: number; source: string }
export interface Criterion { key: string; label: string; max: number; points: number; status: Status; evidence: Evidence[]; missing: string[] }
export interface Level { key: string; label: string; action: string }
export interface ScoreDetail { score: number; level: Level; criteria: Criterion[]; sources?: string[]; missing: string[]; method: string; closed?: boolean }
export interface Opportunity { text: string; status: Status }
export interface Analysis {
  summary: string; main_opportunity: Opportunity | null; opportunities: Opportunity[]; services: { key: string; label: string }[];
  recommendation: string; justification: string; priority: { key: string; label: string }; missing: string[];
}
export interface ProfileRef { id: number; platform: 'instagram' | 'facebook'; handle: string; url: string; api_verified: boolean }
export interface CompanySummary {
  id: number; name: string; activity_label: string | null; activity_key: string | null; city: string | null; zone: string | null; status: string;
  status_label: string; validated: boolean; is_demo: boolean; confidence_score: number; commercial_score: number; priority: number;
  confidence_level?: Level; commercial_level?: Level; main_opportunity: Opportunity | null; services: { key: string; label: string }[];
  priority_label?: { key: string; label: string }; campaign_id: number | null; discovered_at: string; follow_up_at: string | null;
  website: string | null; source: string; profiles: ProfileRef[]; exported_at?: string | null;
}
export interface Profile {
  id: number; company_id: number; platform: 'instagram' | 'facebook'; handle: string; url: string; display_name: string | null; bio: string | null;
  category: string | null; location: string | null; website: string | null; followers: number | null; posts: number | null; likes: number | null;
  checkins: number | null; last_post_at: string | null; snippet: string | null; title: string | null; search_query: string | null; source: string;
  api_verified: number; discovered_at: string;
}
export interface Message { id: number; company_id: number; channel: string; style: string; body: string; provider: string; status: string; created_at: string; sent_at: string | null; note?: string }
export interface EventItem { id: number; company_id: number | null; type: string; detail: string; created_at: string; company_name?: string; is_demo?: number }
export interface Company extends Omit<CompanySummary, 'profiles' | 'services' | 'main_opportunity'> {
  description: string | null; notes: string; source: string; confidence_detail: ScoreDetail; commercial_detail: ScoreDetail; analysis: Analysis;
  website_check: Record<string, unknown> | null; search_location: { city?: string; department_name?: string; region_name?: string; platforms?: string[] };
  profiles: Profile[]; messages: Message[]; events: EventItem[]; suggestions: Suggestion[]; campaign: { id: number; name: string } | null; discovered_at: string;
}
export interface Suggestion { id: number; company_a: number; company_b: number; score: number; reasons: string[]; a_name?: string; b_name?: string }
export interface Referentials {
  regions: { code: string; name: string }[]; departments: { code: string; name: string; region: string }[];
  activities: { key: string; label: string; sector: string; synonyms: string[]; relevance: number }[];
  statuses: { key: string; label: string }[]; styles: { key: string; label: string }[]; channels: { key: string; label: string }[];
}
export interface SearchStats {
  requests: number; results: number; profiles_found: number; instagram: number; facebook: number; new_companies: number; already_known: number;
  suppressed: number; ignored_urls: number; auto_merged: number; suggestions: number; meta_verified: number; websites_checked: number;
  qualified: number; errors: number; target: number; queries_total: number; queries_done: number;
  assisted_queries?: AssistedQuery[];
}
export interface AssistedQuery { query: string; platform: string; links: Record<string, string> }
export interface SearchRun { id: number; campaign_id: number | null; params: Record<string, unknown>; status: string; started_at: string; finished_at: string | null; stats: SearchStats; log?: string[] }
export interface CampaignStats {
  discovered: number; validated: number; high_potential: number; messages_ready: number; messages_sent: number; replies: number; interested: number;
  response_rate: number | null; searches: number;
}
export interface Campaign { id: number; name: string; description: string; params: Record<string, unknown>; archived: number; created_at: string; stats: CampaignStats; searches?: SearchRun[] }
export interface ConnectorStatus {
  id: string; label: string; kind: string; configured: boolean; enabled: boolean; state: string; message: string; used_today: number; daily_limit: number | null;
  free_tier: string; limits: string[]; setup_steps: string[]; features: string[]; permissions_granted: string[]; permissions_missing: string[]; docs_url: string;
}
