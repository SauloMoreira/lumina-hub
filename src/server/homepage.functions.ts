import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Fetch active home banners server-side so the first banner image
 * can be discovered in the initial HTML (preload link + SSR).
 */
export const fetchHomeBanners = createServerFn({ method: "GET" }).handler(
  async () => {
    const supabase = supabaseAdmin;
    const { data, error } = await supabase
      .from("home_banners")
      .select(
        "id, title, subtitle, description, image_desktop, image_mobile, cta_label, cta_link, badge, bg_color, text_color, title_color",
      )
      .order("sort_order", { ascending: true });
    if (error) {
      console.error("fetchHomeBanners error:", error.message);
      return [];
    }
    return data ?? [];
  },
);
