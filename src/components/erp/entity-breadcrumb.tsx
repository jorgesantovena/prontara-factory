"use client";

import Link from "next/link";
import { useCurrentVertical } from "@/lib/saas/use-current-vertical";

/**
 * Breadcrumb homogéneo para las páginas de entidades del ERP.
 *
 * Uso típico:
 *   <EntityBreadcrumb items={[
 *     { href: "/", label: "Inicio" },
 *     { href: "/clientes", label: "Clientes" },
 *     { label: "Acme Industrial" },  // sin href = elemento actual
 *   ]} />
 *
 * El último item se pinta como texto plano. Los previos son links.
 * Si `items.length <= 1` no renderiza nada.
 *
 * TEST-6.3.a — Los hrefs pasan por `useCurrentVertical().link()` para que
 * no caigan al login del middleware cuando vienen sin prefix de vertical.
 */

export type EntityBreadcrumbItem = {
  href?: string;
  label: string;
};

type Props = {
  items: EntityBreadcrumbItem[];
};

export default function EntityBreadcrumb({ items }: Props) {
  const { link } = useCurrentVertical();
  if (!items || items.length <= 1) return null;
  const prefix = (href: string): string => {
    if (!href.startsWith("/") || href.startsWith("/api/")) return href;
    const [path, qs] = href.split("?");
    const prefixed = link(path.replace(/^\/+/, ""));
    return qs ? prefixed + "?" + qs : prefixed;
  };

  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        fontSize: 13,
        color: "#6b7280",
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 6,
      }}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={index} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {!isLast && item.href ? (
              <Link
                href={prefix(item.href)}
                style={{
                  color: "#4b5563",
                  textDecoration: "none",
                }}
              >
                {item.label}
              </Link>
            ) : (
              <span style={{ color: isLast ? "#111827" : "#4b5563", fontWeight: isLast ? 600 : 400 }}>
                {item.label}
              </span>
            )}
            {!isLast ? <span style={{ color: "#9ca3af" }}>/</span> : null}
          </span>
        );
      })}
    </nav>
  );
}
