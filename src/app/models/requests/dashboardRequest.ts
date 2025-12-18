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

export interface TaskInsertData {
  medicaid_id: number;
  action_id: number;
  assign_to: number;
  action_date: string | Date;
  action_note?: string;
  status: string;
  add_by: number;
} 

export interface UpdateTaskRequest {
  table_name: string;
  id_field_name: string;
  id_field_value: number;   // ✅ FIXED (was string)
  updateData: {
    action_id: number;
    assign_to: number;
    action_date: string | Date;
    action_note?: string;
    status: string;
  };
}

export interface TaskRequest {
  table_name: string;
  insertDataArray: TaskInsertData[];
}

export interface TaskInsertData {
  medicaid_id: number;
  action_id: number;
  assign_to: number;
  action_date: Date | string;
  action_note?: string;
  status: string;
  add_by: number;
}

export interface SystemLogData {
  medicaid_id: number;
  log_name: string;
  log_details: string;
  log_status: string;
  log_by: number;
  action_type: string;
}

export interface LogRequest {
  table_name: string;
  insertDataArray: SystemLogData[];
}


