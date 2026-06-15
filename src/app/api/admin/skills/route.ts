import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { AgentSkillUpdateSchema } from "@/lib/domain/agents";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get('agentId');

  const lang = searchParams.get('lang') || 'es-ES';
  const { getHydratedAgents } = await import("@/lib/services/agents");
  let agentsWithSkills = await getHydratedAgents(lang);
  if (agentId) {
    agentsWithSkills = agentsWithSkills.filter(a => a.id === agentId);
  }

  return NextResponse.json({ agents: agentsWithSkills });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = AgentSkillUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const { agentId, key, economy, deployment, lifetime, resolution, color, enabled } = parsed.data;

  try {
    const skill = await db.agentSkill.upsert({
      where: {
        agentId_key: {
          agentId,
          key
        }
      },
      update: {
        economy: economy as any,
        deployment: deployment as any,
        lifetime: lifetime as any,
        resolution: resolution as any,
        color,
        enabled
      },
      create: {
        agentId,
        key,
        economy: economy as any,
        deployment: deployment as any,
        lifetime: lifetime as any,
        resolution: resolution as any,
        color,
        enabled
      }
    });

    const { invalidateAgentsCache } = await import("@/lib/services/agents");
    invalidateAgentsCache();

    return NextResponse.json({ skill });
  } catch (err) {
    return NextResponse.json({ error: "Error saving skill" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  try {
    await db.agentSkill.delete({
      where: { id }
    });
    const { invalidateAgentsCache } = await import("@/lib/services/agents");
    invalidateAgentsCache();

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Error deleting skill" }, { status: 500 });
  }
}
