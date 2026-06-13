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

  const whereClause = agentId ? { id: agentId } : {};

  const agentsWithSkills = await db.agent.findMany({
    where: whereClause,
    include: {
      skills: true
    },
    orderBy: { name: 'asc' }
  });

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

  const { agentId, key, name, description, economy, deployment, lifetime, resolution, color, displayIcon, enabled, type } = parsed.data;

  try {
    const skill = await db.agentSkill.upsert({
      where: {
        agentId_key: {
          agentId,
          key
        }
      },
      update: {
        name,
        description,
        economy: economy as any,
        deployment: deployment as any,
        lifetime: lifetime as any,
        resolution: resolution as any,
        color,
        displayIcon,
        type,
        enabled
      },
      create: {
        agentId,
        key,
        name,
        description,
        economy: economy as any,
        deployment: deployment as any,
        lifetime: lifetime as any,
        resolution: resolution as any,
        color,
        displayIcon,
        type,
        enabled
      }
    });

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
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Error deleting skill" }, { status: 500 });
  }
}
