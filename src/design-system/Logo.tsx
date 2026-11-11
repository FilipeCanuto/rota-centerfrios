import logo from "@/assets/logo-centerfrios.png.asset.json";

export function Logo({ className = "h-8" }: { className?: string }) {
  return (
    <img
      src={logo.url}
      alt="CENTERFRIOS"
      className={`${className} w-auto max-w-full object-contain`}
    />
  );
}
