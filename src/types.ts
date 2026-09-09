export type AccountStatus =
  | "Running"
  | "ReauthRequired"
  | "Error"
  | "Disabled";

export type RedirectStatus = "Seen" | "Success" | "Failed" | "Skipped";

export type Account = {
  id: string;
  email: string;
  status: AccountStatus;
  status_changed_at: string;
  microsoft_user_id: string;
  token_file: string;
  delta_link: string;
  last_sync_at: string;
  error_count: string;
  last_error: string;
  created_at: string;
  updated_at: string;
};

export type RedirectRow = {
  id: string;
  account_id: string;
  email: string;
  graph_message_id: string;
  internet_message_id: string;
  subject: string;
  from_addr: string;
  to_addr: string;
  received_at: string;
  eml_path: string;
  redirect_status: RedirectStatus;
  redirected_at: string;
  last_error: string;
  created_at: string;
};

export const ACCOUNT_COLUMNS: (keyof Account)[] = [
  "id",
  "email",
  "status",
  "status_changed_at",
  "microsoft_user_id",
  "token_file",
  "delta_link",
  "last_sync_at",
  "error_count",
  "last_error",
  "created_at",
  "updated_at",
];

export const REDIRECT_COLUMNS: (keyof RedirectRow)[] = [
  "id",
  "account_id",
  "email",
  "graph_message_id",
  "internet_message_id",
  "subject",
  "from_addr",
  "to_addr",
  "received_at",
  "eml_path",
  "redirect_status",
  "redirected_at",
  "last_error",
  "created_at",
];
