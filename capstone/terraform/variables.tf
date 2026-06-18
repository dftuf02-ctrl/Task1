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

variable "supabase_anon_key" {
  description = "Supabase anon key."
  type        = string
  sensitive   = true
}
