/**
 * Estructura del mensaje de auditoría que viaja por Kafka.
 * Compartida entre el consumer, el service y los handlers.
 */
export interface AuditEventData {
  event_type:      string;
  source_system?:  string;
  trace_id?:       string;
  user_id?:        string;
  username?:       string;
  session_id?:     string;
  action?:         string;
  outcome?:        string;
  level?:          string;
  message?:        string;
  ip_address?:     string;
  user_agent?:     string;
  reason?:         string;
  payload?:        Record<string, any>;
  timestamp?:      string;
  // campos específicos de gateway
  request_path?:   string;
  method?:         string;
  correlation_id?: string;
  // campos específicos de token
  token_type?:     string;
}
