variable "namespace" {
  description = "Kubernetes namespace for the capstone."
  type        = string
  default     = "taskflow-cap"
}

variable "kubeconfig" {
  description = "Path to kubeconfig."
  type        = string
  default     = "~/.kube/config"
}

variable "kube_context" {
  description = "Kube context to deploy into."
  type        = string
  default     = "minikube"
}

variable "supabase_url" {
  description = "Supabase project URL."
  type        = string
  sensitive   = true
}

variable "supabase_service_role_key" {
  description = "Supabase service-role key (server-side only). The backend requires it under NODE_ENV=production and refuses to start on the anon key."
  type        = string
  sensitive   = true
}
