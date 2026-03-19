import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const orgId = searchParams.get("orgId");
    const specificBotId = searchParams.get("botId");

    if (!orgId) {
        return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Fetch Bot Config
    // If a specific botId is provided, look for that one.
    // Otherwise, look for the first enabled bot for this org.
    let botQuery = supabase
        .from("bot_configs")
        .select("id, name, enabled, styles")
        .eq("org_id", orgId);

    if (specificBotId) {
        botQuery = botQuery.eq("id", specificBotId);
    } else {
        botQuery = botQuery.eq("enabled", true).limit(1);
    }

    const { data: bots, error: botError } = await botQuery;

    if (botError) {
        console.error("Error fetching bot config:", botError);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }

    const botConfig = bots && bots.length > 0 ? bots[0] : null;

    // 2. Fetch NPS Config (Placeholder for future)
    // const npsConfig = await fetchNpsConfig(orgId);

    // 3. Log analytics (Placeholder)
    // await logPageView(orgId, req);

    return NextResponse.json({
        bot: {
            enabled: !!botConfig,
            id: botConfig?.id || null,
            name: botConfig?.name || null,
            styles: botConfig?.styles || null,
        },
        nps: {
            enabled: false // Future feature
        },
        // Global settings or flags can go here
        settings: {
            primaryColor: botConfig?.styles?.primary_color || "#000000"
        }
    });
}
