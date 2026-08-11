import AdminAdsPanel from "@/components/AdminAdsPanel";
import AdminLoginForm from "@/components/AdminLoginForm";
import { readAdsConfig } from "@/lib/ads";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const authed = await isAdminAuthenticated();

  if (!authed) {
    return <AdminLoginForm />;
  }

  const config = await readAdsConfig();
  const apiKeySet = Boolean(
    config.adsterra?.apiKey?.trim() || process.env.ADSTERRA_API_KEY?.trim(),
  );
  return (
    <AdminAdsPanel
      initial={{
        ...config,
        adsterra: {
          ...config.adsterra,
          apiKey: "",
          ...( { apiKeySet } as { apiKeySet?: boolean }),
        },
      }}
    />
  );
}
