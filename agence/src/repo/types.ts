/** Types des lignes de la base (snake_case, comme en SQL). */
export interface ServiceRow {
  id: number;
  slug: string;
  category: string;
  name: string;
  summary: string;
  description: string;
  price_mode: 'fixed' | 'from' | 'quote';
  price_ht: number | null;
  billing: 'once' | 'monthly';
  lead_time: string;
  revisions: number | null;
  options: string;
  includes: string;
  conditions: string;
  exclusions: string;
  image: string;
  status: string;
  featured: number;
  sort_order: number;
  cost_production: number;
  cost_supplier: number;
  cost_shipping: number;
  cost_external: number;
  work_hours: number;
  created_at: string;
  updated_at: string;
}

export interface ProductRow {
  id: number;
  slug: string;
  family: string;
  name: string;
  summary: string;
  description: string;
  supplier: string;
  supplier_url: string;
  options: string;
  options_checked_at: string | null;
  design_service_slug: string | null;
  visual: string;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface VariantFull {
  id: number;
  product_id: number;
  supplier: string;
  product_name: string;
  supplier_url: string;
  format: string;
  orientation: string;
  paper: string;
  weight: string;
  finish: string;
  printing: string;
  extra: string;
  quantity: number;
  delivery: string;
  supplier_price_ht: number | null;
  supplier_shipping_ht: number | null;
  supplier_other_fees_ht: number | null;
  currency: string;
  lead_time_days: number | null;
  verified_at: string | null;
  source: string;
  status: string;
  notes: string;
  sale_print_ht: number | null;
  sale_shipping_ht: number | null;
  sale_other_ht: number | null;
  sale_validated_at: string | null;
  cost_at_validation: number | null;
  created_at: string;
  updated_at: string;
}

export interface ContactRow {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  postal_code: string;
  city: string;
  siren: string;
  customer_type: 'pro' | 'particulier';
  source: string;
  need: string;
  budget: string;
  status: string;
  last_contact_at: string | null;
  next_action: string;
  next_action_at: string | null;
  notes: string;
  consent_marketing: number;
  consent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RequestRow {
  id: number;
  contact_id: number | null;
  kind: string;
  service_slug: string;
  product_slug: string;
  answers: string;
  print_config: string | null;
  estimate: string | null;
  files: string;
  status: string;
  created_at: string;
}

export interface QuoteRow {
  id: number;
  number: string | null;
  contact_id: number;
  request_id: number | null;
  title: string;
  status: string;
  issue_date: string | null;
  valid_until: string | null;
  intro: string;
  terms: string;
  deposit_percent: number;
  token: string;
  sent_at: string | null;
  decided_at: string | null;
  decided_name: string | null;
  client_comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface LineRow {
  id: number;
  position: number;
  kind?: string;
  description: string;
  quantity: number;
  unit_price_ht: number;
  vat_rate: number;
  unit_cost_ht: number;
}

export interface OrderRow {
  id: number;
  number: string;
  contact_id: number;
  quote_id: number | null;
  product_id: number | null;
  variant_id: number | null;
  description: string;
  config: string;
  status: string;
  bat_required: number;
  supplier: string;
  supplier_order_ref: string;
  supplier_ordered_at: string | null;
  supplier_cost_ht: number | null;
  sale_total_ht: number | null;
  tracking_url: string;
  estimated_delivery: string | null;
  validated_proof_id: number | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ProofRow {
  id: number;
  order_id: number;
  version: number;
  file_key: string;
  file_name: string;
  pdf_info: string | null;
  checklist: string;
  status: string;
  token: string;
  sent_at: string | null;
  decided_at: string | null;
  decided_name: string | null;
  client_comment: string | null;
  created_at: string;
}

export interface ProjectRow {
  id: number;
  contact_id: number;
  quote_id: number | null;
  name: string;
  status: string;
  brief: string;
  identity: string;
  texts: string;
  photos: string;
  sitemap: string;
  domain: string;
  hosting: string;
  staging_url: string;
  production_url: string;
  current_version: string;
  seo_checklist: string;
  security_checklist: string;
  acceptance_status: string;
  acceptance_token: string;
  acceptance_at: string | null;
  acceptance_name: string | null;
  acceptance_comment: string | null;
  due_date: string | null;
  delivered_at: string | null;
  maintenance_terms: string;
  backups: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceRow {
  id: number;
  number: string | null;
  type: 'facture' | 'avoir';
  original_invoice_id: number | null;
  contact_id: number;
  quote_id: number | null;
  status: string;
  customer: string;
  seller: string | null;
  issue_date: string | null;
  service_date: string | null;
  due_date: string | null;
  operation_category: string;
  notes: string;
  total_ht: number;
  total_vat: number;
  total_ttc: number;
  cost_ht: number;
  paid_at: string | null;
  payment_method: string;
  created_at: string;
  updated_at: string;
}

export interface PortfolioRow {
  id: number;
  slug: string;
  title: string;
  category: string;
  is_concept: number;
  client_label: string;
  summary: string;
  challenge: string;
  solution: string;
  outcome: string;
  deliverables: string;
  visual: string;
  accent: string;
  is_case_study: number;
  featured: number;
  status: string;
  sort_order: number;
  client_type: string;
  need: string;
  /** Prestations liées, une par ligne : « /chemin | Libellé ». */
  services: string;
  objectives: string;
  before_label: string;
  after_label: string;
  testimonial: string;
  testimonial_author: string;
  testimonial_authorized: number;
}

export interface PostRow {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  category: string;
  status: string;
  published_at: string | null;
  meta_title: string;
  meta_description: string;
  updated_at: string;
}

export interface FaqRow {
  id: number;
  topic: string;
  question: string;
  answer: string;
  status: string;
  sort_order: number;
}

export interface LocalPageRow {
  id: number;
  slug: string;
  city: string;
  title: string;
  intro: string;
  body: string;
  meta_description: string;
  status: string;
  updated_at: string;
}
