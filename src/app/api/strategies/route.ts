import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  const teamId = session?.user?.teamId;
  if (!teamId) return NextResponse.json({ error: "No team context" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const mapId = searchParams.get("map_id");

  // Single strategy fetch (for polling sync)
  if (id) {
    const strategy = await db.strategy.findUnique({
      where: { id: Number(id) }
    });
    if (!strategy || strategy.teamId !== teamId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ strategy });
  }

  const strategies = await db.strategy.findMany({
    where: {
      teamId,
      ...(mapId ? { map_id: mapId } : {})
    },
    orderBy: [
      { side: 'asc' },
      { updated_at: 'desc' }
    ]
  });

  const activeCutoff = new Date(Date.now() - 15000);
  const presences = await db.strategyPresence.findMany({
    where: {
      strategyId: { in: strategies.map(s => s.id) },
      updatedAt: { gte: activeCutoff }
    }
  });

  const strategiesWithPresence = strategies.map(s => ({
    ...s,
    active_users: presences.filter(p => p.strategyId === s.id)
  }));
  
  return NextResponse.json({ strategies: strategiesWithPresence });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const teamId = session?.user?.teamId;
  if (!teamId) return NextResponse.json({ error: "No team context" }, { status: 400 });

  const body = await req.json();
  const { map_id, name, side, description, canvas_data } = body;
  
  if (!map_id || !name)
    return NextResponse.json({ error: "map_id and name required" }, { status: 400 });

  const strategy = await db.strategy.create({
    data: {
      teamId,
      map_id,
      name,
      side: side || "attack",
      description: description || "",
      canvas_data: canvas_data || {}
    }
  });
  
  return NextResponse.json({ id: strategy.id });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, name, side, description, canvas_data } = body;
  
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  let updatedStrategy;

  if (canvas_data) {
    try {
      updatedStrategy = await db.$transaction(async (tx) => {
        // Lock the row for updates
        const strategies = await tx.$queryRaw<any[]>`
          SELECT canvas_data FROM "Strategy" 
          WHERE id = ${Number(id)} 
          FOR UPDATE
        `;

        let finalCanvasData = canvas_data;

        if (strategies && strategies.length > 0) {
          const existingCanvasRaw = strategies[0].canvas_data;
          const existingCanvas = (typeof existingCanvasRaw === "string"
            ? JSON.parse(existingCanvasRaw || "{}")
            : existingCanvasRaw || {}) as any;

          const existingPaths = (existingCanvas.paths || []) as any[];
          const existingAgents = (existingCanvas.agents || []) as any[];
          const existingSkills = (existingCanvas.skills || []) as any[];

          // Ensure all existing elements have IDs
          existingPaths.forEach(p => {
            if (!p.id) p.id = Math.random().toString(36).substring(2, 9);
          });
          existingAgents.forEach(a => {
            if (!a.instanceId) a.instanceId = Math.random().toString(36).substring(2, 9);
          });
          existingSkills.forEach(s => {
            if (!s.instanceId) s.instanceId = Math.random().toString(36).substring(2, 9);
          });

          const incomingPaths = (canvas_data.paths || []) as any[];
          const incomingAgents = (canvas_data.agents || []) as any[];
          const incomingSkills = (canvas_data.skills || []) as any[];

          // Ensure all incoming elements have IDs
          incomingPaths.forEach(p => {
            if (!p.id) p.id = Math.random().toString(36).substring(2, 9);
          });
          incomingAgents.forEach(a => {
            if (!a.instanceId) a.instanceId = Math.random().toString(36).substring(2, 9);
          });
          incomingSkills.forEach(s => {
            if (!s.instanceId) s.instanceId = Math.random().toString(36).substring(2, 9);
          });

          const clientKnownPathIds = new Set(canvas_data.clientKnownPathIds || []);
          const clientKnownAgentIds = new Set(canvas_data.clientKnownAgentIds || []);
          const clientKnownSkillIds = new Set(canvas_data.clientKnownSkillIds || []);

          // 1. Merge Paths
          const finalPaths: any[] = [];
          const incomingPathsMap = new Map(incomingPaths.map(p => [p.id, p]));
          const existingPathsMap = new Map(existingPaths.map(p => [p.id, p]));

          for (const p of existingPaths) {
            if (incomingPathsMap.has(p.id)) {
              finalPaths.push(incomingPathsMap.get(p.id));
            } else {
              // If in DB but not in incoming:
              // Keep it if the client did NOT know about it (created by another client).
              // Remove it if the client knew about it (meaning the client deleted/undid it).
              if (!clientKnownPathIds.has(p.id)) {
                finalPaths.push(p);
              }
            }
          }
          for (const p of incomingPaths) {
            if (!existingPathsMap.has(p.id)) {
              finalPaths.push(p);
            }
          }

          // 2. Merge Agents
          const finalAgents: any[] = [];
          const incomingAgentsMap = new Map(incomingAgents.map(a => [a.instanceId, a]));
          const existingAgentsMap = new Map(existingAgents.map(a => [a.instanceId, a]));

          for (const a of existingAgents) {
            if (incomingAgentsMap.has(a.instanceId)) {
              finalAgents.push(incomingAgentsMap.get(a.instanceId));
            } else {
              // If in DB but not in incoming:
              // Keep it if client did NOT know about it (created by another client).
              // Remove it if client knew about it (meaning client deleted it).
              if (!clientKnownAgentIds.has(a.instanceId)) {
                finalAgents.push(a);
              }
            }
          }
          for (const a of incomingAgents) {
            if (!existingAgentsMap.has(a.instanceId)) {
              finalAgents.push(a);
            }
          }

          // 3. Merge Skills
          const finalSkills: any[] = [];
          const incomingSkillsMap = new Map(incomingSkills.map(s => [s.instanceId, s]));
          const existingSkillsMap = new Map(existingSkills.map(s => [s.instanceId, s]));

          for (const s of existingSkills) {
            if (incomingSkillsMap.has(s.instanceId)) {
              finalSkills.push(incomingSkillsMap.get(s.instanceId));
            } else {
              if (!clientKnownSkillIds.has(s.instanceId)) {
                finalSkills.push(s);
              }
            }
          }
          for (const s of incomingSkills) {
            if (!existingSkillsMap.has(s.instanceId)) {
              finalSkills.push(s);
            }
          }

          finalCanvasData = {
            paths: finalPaths,
            agents: finalAgents,
            skills: finalSkills
          };
        }

        return await tx.strategy.update({
          where: { id: Number(id) },
          data: {
            name,
            side,
            description,
            canvas_data: finalCanvasData || undefined
          }
        });
      }, {
        timeout: 10000
      });
    } catch (err) {
      console.error("Lock/Merge transaction failed:", err);
      return NextResponse.json({ error: "Lock/Merge transaction failed" }, { status: 500 });
    }
  } else {
    updatedStrategy = await db.strategy.update({
      where: { id: Number(id) },
      data: {
        name,
        side,
        description
      }
    });
  }
  
  return NextResponse.json({
    ok: true,
    canvas_data: updatedStrategy?.canvas_data,
    updated_at: updatedStrategy?.updated_at
  });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  
  await db.strategy.delete({
    where: { id: Number(id) }
  });
  
  return NextResponse.json({ ok: true });
}
