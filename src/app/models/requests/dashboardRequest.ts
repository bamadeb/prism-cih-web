export class DashboardRequest {
     user_id?: number | null;
}

export interface ProviderPerformance {
  priority_count: number;
  call_count: number;
  other_count: number;
  other_call_count: number;
  priority_gaps_count: number;
  priority_complete_gaps_count: number;
  other_gaps_count: number;
  other_complete_gaps_count: number;
  priority_quality_gaps_count: number;
  priority_complete_quality_gaps_count: number;
  other_quality_gaps_count: number;
  other_complete_quality_gaps_count: number;
  priority_pcp_visit_count: number;
  other_pcp_visit_count: number;
  priority_percentage: number;
  priority_color: string;
  other_call_percentage: number;
  other_call_color: string;
  priority_gaps_percentage: number;
  priority_gaps_color: string;
  other_gaps_percentage: number;
  other_gaps_color: string;
  priority_quality_gaps_percentage: number;
  priority_quality_gaps_color: string;
  other_quality_gaps_percentage: number;
  other_quality_gaps_color: string;
  priority_pcp_visit_percentage: number;
  priority_pcp_visit_color: string;
  other_pcp_visit_percentage: number;
  other_pcp_visit_color: string;
  provider_name: string;
}

export class BenefitsRequest {
     medicaid_id?: number | null;
}

export class QualitygapRequest {
     medicaid_id?: number | null;
}

export class RiskgapRequest {
     medicaid_id?: number | null;
}

export class CallListRequest {
     medicaid_id?: number | null;
}

export class TaskListRequest {
     medicaid_id?: number | null;
}
