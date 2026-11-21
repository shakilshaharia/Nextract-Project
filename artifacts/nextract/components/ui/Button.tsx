import type { ComponentPropsWithoutRef } from "react";
import styles from "./Button.module.css";

type SharedProps = {
  variant?: "primary" | "secondary";
  size?: "md" | "sm";
  /** Soft lifted shadow used by the hero and demo CTAs. */
  elevated?: boolean;
  /** 1px light border used by the header button. */
  outlined?: boolean;
};

function buildClasses(
  { variant = "primary", size = "md", elevated = false, outlined = false }: SharedProps,
  className?: string,
) {
  return [
    styles.button,
    styles[variant],
    styles[size],
    elevated && styles.elevated,
    outlined && styles.outlined,
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

type ButtonLinkProps = ComponentPropsWithoutRef<"a"> & SharedProps;

export function ButtonLink({
  variant,
  size,
  elevated,
  outlined,
  className,
  ...props
}: ButtonLinkProps) {
  return (
    <a className={buildClasses({ variant, size, elevated, outlined }, className)} {...props} />
  );
}

type ButtonProps = ComponentPropsWithoutRef<"button"> & SharedProps;

/** Same visual as ButtonLink, but a real <button> for in-page actions (e.g. opening a modal). */
export function Button({
  variant,
  size,
  elevated,
  outlined,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buildClasses({ variant, size, elevated, outlined }, className)}
      {...props}
    />
  );
}
