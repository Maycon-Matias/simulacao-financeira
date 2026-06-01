import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Consulta registro Porã Cred",
  description: "Sistema de consultas e simulações de crédito consignado",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}

