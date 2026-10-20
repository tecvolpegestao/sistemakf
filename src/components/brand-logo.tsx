/* eslint-disable @next/next/no-img-element */
export function BrandLogo({
  className = "h-14",
  tone = "auto",
}: {
  className?: string;
  tone?: "auto" | "on-dark" | "on-light";
}) {
  if (tone === "on-dark") {
    return <img src="/brand/logo-dark.png" alt="KF Detail" className={`${className} w-auto`} />;
  }
  if (tone === "on-light") {
    return <img src="/brand/logo-light.png" alt="KF Detail" className={`${className} w-auto`} />;
  }
  return (
    <span className="inline-flex" role="img" aria-label="KF Detail">
      <img src="/brand/logo-light.png" alt="" className={`${className} w-auto dark:hidden`} />
      <img src="/brand/logo-dark.png" alt="" className={`hidden ${className} w-auto dark:block`} />
    </span>
  );
}
