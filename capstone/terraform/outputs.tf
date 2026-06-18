output "namespace" {
  value       = kubernetes_namespace.cap.metadata[0].name
  description = "Capstone namespace."
}

output "secret_name" {
  value       = kubernetes_secret.app.metadata[0].name
  description = "Name of the k8s Secret holding app credentials."
}
