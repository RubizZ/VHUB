const fs = require('fs');

const origBuf = fs.readFileSync('original_AgentSkillsManager.tsx');
const origStr = origBuf[0] === 0xff && origBuf[1] === 0xfe ? origBuf.toString('utf16le') : origBuf.toString('utf8');

const newBuf = fs.readFileSync('new_AgentSkillsManager.tsx');
const newStr = newBuf[0] === 0xff && newBuf[1] === 0xfe ? newBuf.toString('utf16le') : newBuf.toString('utf8');

const headEnd = newStr.indexOf('export function AgentSkillsManager');
const head = newStr.slice(0, headEnd);

const funcStart = newStr.indexOf('export function AgentSkillsManager');
const returnIndex = newStr.indexOf('return (', funcStart);
// Grab up to the toggleVision function
const toggleVisionEnd = newStr.indexOf('return (', newStr.indexOf('const toggleVision')) - 1;
const funcBody = newStr.slice(funcStart, toggleVisionEnd);

const origReturnStart = origStr.indexOf('return (', origStr.indexOf('export function AgentSkillsManager'));
const origFormStart = origStr.indexOf('<form onSubmit={handleSubmit}>', origReturnStart);

const layoutHeader = origStr.slice(origReturnStart, origFormStart + '<form onSubmit={handleSubmit}>'.length);

const formJSX = `
                  <div style={{ marginBottom: 32 }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                       {["q", "e", "c", "x", "passive"].map(key => (
                         <button type="button" key={key} onClick={() => { setEditingSkillKey(key); loadSkillForm(selectedAgent, key); }} className={\`btn \${editingSkillKey === key ? "btn-primary" : "btn-secondary"}\`} style={{ flex: 1, minWidth: 80 }}>
                           {key.toUpperCase()}
                         </button>
                       ))}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 12, marginBottom: 24, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 16 }}>
                    <button type="button" onClick={() => setActiveTab("general")} className={\`btn \${activeTab === "general" ? "btn-primary" : "btn-secondary"}\`}>General</button>
                    <button type="button" onClick={() => setActiveTab("deployment")} className={\`btn \${activeTab === "deployment" ? "btn-primary" : "btn-secondary"}\`}>1. Despliegue</button>
                    <button type="button" onClick={() => setActiveTab("lifetime")} className={\`btn \${activeTab === "lifetime" ? "btn-primary" : "btn-secondary"}\`}>2. Vida Activa</button>
                    <button type="button" onClick={() => setActiveTab("resolution")} className={\`btn \${activeTab === "resolution" ? "btn-primary" : "btn-secondary"}\`}>3. Resolución</button>
                  </div>

                  {activeTab === "general" && (
                    <div>
                      <div className="form-row" style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12 }}>Nombre</label>
                          <input className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12 }}>Tipo</label>
                          <select className="input-field" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                            <option value="Basic">Básica</option>
                            <option value="Signature">Firma (Signature)</option>
                            <option value="Ultimate">Ultimate</option>
                            <option value="Passive">Pasiva</option>
                          </select>
                        </div>
                      </div>
                      <div className="form-group" style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12 }}>Descripción</label>
                        <textarea className="input-field" rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
                        <img src={formData.displayIcon} style={{ width: 48, height: 48, borderRadius: 8, background: "rgba(0,0,0,0.5)" }} />
                        <button type="button" className="btn btn-secondary" onClick={handleSearchIcon}>Buscar Icono en API</button>
                      </div>
                      <div className="form-row" style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12 }}>Coste (Créditos)</label>
                          <input type="number" className="input-field" value={formData.costCredits} onChange={e => setFormData({...formData, costCredits: Number(e.target.value)})} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12 }}>Coste (Orbes de Ulti)</label>
                          <input type="number" className="input-field" value={formData.costUltPoints} onChange={e => setFormData({...formData, costUltPoints: Number(e.target.value)})} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12 }}>Usos por ronda</label>
                          <input type="number" className="input-field" value={formData.usesPerRound} onChange={e => setFormData({...formData, usesPerRound: Number(e.target.value)})} />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "deployment" && (
                    <div>
                      <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 16 }}>Define cómo la habilidad entra y viaja por el mundo.</p>
                      <div className="form-row" style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12 }}>Tipo de Despliegue</label>
                          <select className="input-field" value={formData.dep_type} onChange={e => setFormData({...formData, dep_type: e.target.value as any})}>
                            <option value="self_instant">Instantáneo (Self / Aura)</option>
                            <option value="projectile_terminal_aoe">Proyectil (Termina en AoE)</option>
                            <option value="projectile_sweeping">Proyectil (Pasa a través)</option>
                            <option value="map_target_aoe">Selección en Mapa (Click to place)</option>
                            <option value="linear_wall">Muro Lineal</option>
                            <option value="two_point_barrier">Barrera de 2 Puntos</option>
                            <option value="static_deployable">Desplegable Estático (Trampa/Torreta)</option>
                          </select>
                        </div>
                      </div>
                      <div className="form-row" style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12 }}>Tiempo de Carga / Windup (seg)</label>
                          <input type="number" step="0.1" className="input-field" value={formData.dep_windup} onChange={e => setFormData({...formData, dep_windup: Number(e.target.value)})} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12 }}>Rango de Cast (metros)</label>
                          <input type="number" className="input-field" value={formData.dep_castRange} onChange={e => setFormData({...formData, dep_castRange: Number(e.target.value)})} />
                        </div>
                      </div>
                      
                      {(formData.dep_type.includes("projectile")) && (
                        <div style={{ background: "rgba(255,255,255,0.05)", padding: 16, borderRadius: 8, marginBottom: 16 }}>
                          <div className="form-row" style={{ display: "flex", gap: 16 }}>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label style={{ fontSize: 12 }}>Velocidad Proyectil</label>
                              <input type="number" className="input-field" value={formData.dep_projectileSpeed} onChange={e => setFormData({...formData, dep_projectileSpeed: Number(e.target.value)})} />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label style={{ fontSize: 12 }}>Distancia Máxima (Fusible)</label>
                              <input type="number" className="input-field" value={formData.dep_projectileMaxDistance} onChange={e => setFormData({...formData, dep_projectileMaxDistance: Number(e.target.value)})} />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label style={{ fontSize: 12 }}>Rebotes Permitidos</label>
                              <input type="number" className="input-field" value={formData.dep_bounces} onChange={e => setFormData({...formData, dep_bounces: Number(e.target.value)})} />
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="form-group" style={{ marginBottom: 16 }}>
                        <GeometryEditor 
                          prefixLabel="Rastro/Barrido" 
                          type={formData.dep_geom_type} 
                          radius={formData.dep_geom_radius} 
                          width={formData.dep_geom_width} 
                          length={formData.dep_geom_length} 
                          onTypeChange={(v: string) => setFormData({...formData, dep_geom_type: v})}
                          onRadiusChange={(v: number) => setFormData({...formData, dep_geom_radius: v})}
                          onWidthChange={(v: number) => setFormData({...formData, dep_geom_width: v})}
                          onLengthChange={(v: number) => setFormData({...formData, dep_geom_length: v})}
                        />
                      </div>
                      
                      <div className="form-group" style={{ marginBottom: 16 }}>
                        <h4 style={{ color: "var(--val-red)", marginBottom: 8 }}>Efectos al impactar/atravesar</h4>
                        <EffectsEditor effects={formData.dep_effects} onChange={(eff: any) => setFormData({...formData, dep_effects: eff})} />
                      </div>
                    </div>
                  )}

                  {activeTab === "lifetime" && (
                    <div>
                      <div className="form-row" style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12 }}>Duración (segundos)</label>
                          <input type="number" step="0.1" className="input-field" value={formData.life_duration} onChange={e => setFormData({...formData, life_duration: Number(e.target.value)})} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: 12 }}>Puntos de Vida (0 si es invulnerable)</label>
                          <input type="number" className="input-field" value={formData.life_hp} onChange={e => setFormData({...formData, life_hp: Number(e.target.value)})} />
                        </div>
                      </div>
                      
                      <div className="form-group" style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12 }}>Comportamiento Físico/IA</label>
                        <select className="input-field" value={formData.life_behavior} onChange={e => setFormData({...formData, life_behavior: e.target.value as any})}>
                          <option value="static">Estático (Se queda donde se planta)</option>
                          <option value="autonomous">IA Autónoma (Persigue o Detecta enemigos)</option>
                          <option value="mobile_aura">Aura Móvil (Se mueve con el jugador)</option>
                        </select>
                      </div>
                      
                      {formData.life_behavior === "autonomous" && (
                        <div style={{ background: "rgba(59,130,246,0.1)", padding: 16, borderRadius: 8, marginBottom: 16, border: "1px solid rgba(59,130,246,0.3)" }}>
                          <div className="form-row" style={{ display: "flex", gap: 16 }}>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label style={{ fontSize: 12, color: "var(--val-cyan)" }}>Radio de Detección</label>
                              <input type="number" className="input-field" value={formData.life_activationRadius} onChange={e => setFormData({...formData, life_activationRadius: Number(e.target.value)})} />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label style={{ fontSize: 12, color: "var(--val-cyan)" }}>Velocidad de Movimiento</label>
                              <input type="number" className="input-field" value={formData.life_movementSpeed} onChange={e => setFormData({...formData, life_movementSpeed: Number(e.target.value)})} />
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="form-group" style={{ marginBottom: 16 }}>
                        <GeometryEditor 
                          prefixLabel="Área de Efecto Plantada" 
                          type={formData.life_geom_type} 
                          radius={formData.life_geom_radius} 
                          width={formData.life_geom_width} 
                          length={formData.life_geom_length} 
                          onTypeChange={(v: string) => setFormData({...formData, life_geom_type: v})}
                          onRadiusChange={(v: number) => setFormData({...formData, life_geom_radius: v})}
                          onWidthChange={(v: number) => setFormData({...formData, life_geom_width: v})}
                          onLengthChange={(v: number) => setFormData({...formData, life_geom_length: v})}
                        />
                      </div>
                      
                      <div className="form-group" style={{ marginBottom: 16 }}>
                        <h4 style={{ color: "var(--val-red)", marginBottom: 8 }}>Efectos Activos (Ticking / Constantes)</h4>
                        <EffectsEditor effects={formData.life_effects} onChange={(eff: any) => setFormData({...formData, life_effects: eff})} />
                      </div>
                    </div>
                  )}

                  {activeTab === "resolution" && (
                    <div>
                      <label className="checkbox-label" style={{ padding: 12, background: "rgba(255,255,255,0.05)", borderRadius: 8, marginBottom: 16 }}>
                        <input type="checkbox" checked={formData.hasResolution} onChange={e => setFormData({...formData, hasResolution: e.target.checked})} />
                        <span className="checkbox-custom"></span>
                        <span style={{ fontWeight: 800 }}>Habilitar Fase de Resolución (Muerte/Explosión)</span>
                      </label>
                      
                      {formData.hasResolution && (
                        <div>
                          <div className="form-group" style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 12 }}>Trigger (Desencadenante)</label>
                            <select className="input-field" value={formData.res_trigger} onChange={e => setFormData({...formData, res_trigger: e.target.value as any})}>
                              <option value="on_impact">Al Impactar (Ej: Flecha Raze)</option>
                              <option value="on_timer">Por Tiempo (Ej: Flash Kayo)</option>
                              <option value="on_recast">Al Recastear (Ej: C4 Raze)</option>
                              <option value="on_death">Al morir entidad</option>
                            </select>
                          </div>
                          
                          <div className="form-group" style={{ marginBottom: 16 }}>
                            <GeometryEditor 
                              prefixLabel="Área de Explosión/Impacto" 
                              type={formData.res_geom_type} 
                              radius={formData.res_geom_radius} 
                              width={formData.res_geom_width} 
                              length={formData.res_geom_length} 
                              onTypeChange={(v: string) => setFormData({...formData, res_geom_type: v})}
                              onRadiusChange={(v: number) => setFormData({...formData, res_geom_radius: v})}
                              onWidthChange={(v: number) => setFormData({...formData, res_geom_width: v})}
                              onLengthChange={(v: number) => setFormData({...formData, res_geom_length: v})}
                            />
                          </div>
                          
                          <div className="form-group" style={{ marginBottom: 16 }}>
                            <h4 style={{ color: "var(--val-red)", marginBottom: 8 }}>Efectos Terminales</h4>
                            <EffectsEditor effects={formData.res_effects} onChange={(eff: any) => setFormData({...formData, res_effects: eff})} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ marginTop: 32, display: "flex", justifyContent: "flex-end" }}>
                    <button type="submit" className="btn btn-primary" style={{ padding: "12px 32px", fontSize: 16, fontWeight: 900 }}>Guardar Habilidad</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
`;

const tail = `
function EffectsEditor({ effects, onChange }: { effects: any, onChange: (eff: any) => void }) {
  const toggleDamage = () => {
    if (effects.damage) {
      const { damage, ...rest } = effects;
      onChange(rest);
    } else {
      onChange({ ...effects, damage: { type: "burst", baseDamage: 0 } });
    }
  };

  const toggleVision = () => {
    if (effects.vision) {
      const { vision, ...rest } = effects;
      onChange(rest);
    } else {
      onChange({ ...effects, vision: { blocksVision: false } });
    }
  };

  return (
    <div style={{ marginTop: 16 }}>
      <label className="checkbox-label" style={{ marginBottom: 12 }}>
        <input type="checkbox" checked={!!effects.damage} onChange={toggleDamage} />
        <span className="checkbox-custom"></span>
        <span style={{fontWeight: "bold"}}>Aplica Daño</span>
      </label>
      
      {effects.damage && (
        <div style={{ marginBottom: 16, padding: 12, background: "rgba(0,0,0,0.2)", borderRadius: 8 }}>
          <select className="input-field" style={{marginBottom: 8}} value={effects.damage.type || "burst"} onChange={e => onChange({...effects, damage: {...effects.damage, type: e.target.value as any}})}>
            <option value="burst">Burst (Instantáneo)</option>
            <option value="dot">DoT (Daño por segundo)</option>
            <option value="decay">Decay (Temporal)</option>
          </select>
          <div style={{display: "flex", gap: 8}}>
            <div className="form-group" style={{flex: 1}}>
              <label style={{fontSize: 12}}>Daño Base</label>
              <input type="number" className="input-field" value={effects.damage.baseDamage || 0} onChange={e => onChange({...effects, damage: {...effects.damage, baseDamage: Number(e.target.value)}})} />
            </div>
            <div className="form-group" style={{flex: 1}}>
              <label style={{fontSize: 12}}>Daño por Tick/Pulso</label>
              <input type="number" className="input-field" value={effects.damage.damagePerPulse || 0} onChange={e => onChange({...effects, damage: {...effects.damage, damagePerPulse: Number(e.target.value)}})} />
            </div>
          </div>
        </div>
      )}

      <label className="checkbox-label" style={{ marginBottom: 12 }}>
        <input type="checkbox" checked={!!effects.vision} onChange={toggleVision} />
        <span className="checkbox-custom"></span>
        <span style={{fontWeight: "bold"}}>Aplica Efectos de Visión</span>
      </label>

      {effects.vision && (
        <div style={{ marginBottom: 16, padding: 12, background: "rgba(0,0,0,0.2)", borderRadius: 8 }}>
          <label className="checkbox-label"><input type="checkbox" checked={effects.vision.blocksVision} onChange={e => onChange({...effects, vision: {...effects.vision, blocksVision: e.target.checked}})} /><span className="checkbox-custom"></span><span style={{fontSize: 12}}>Bloquea Visión (Humo/Muro)</span></label>
          <label className="checkbox-label"><input type="checkbox" checked={effects.vision.nearsight} onChange={e => onChange({...effects, vision: {...effects.vision, nearsight: e.target.checked}})} /><span className="checkbox-custom"></span><span style={{fontSize: 12}}>Nearsight (Miope)</span></label>
          <label className="checkbox-label"><input type="checkbox" checked={effects.vision.flash} onChange={e => onChange({...effects, vision: {...effects.vision, flash: e.target.checked}})} /><span className="checkbox-custom"></span><span style={{fontSize: 12}}>Flash</span></label>
          <label className="checkbox-label"><input type="checkbox" checked={effects.vision.reveal} onChange={e => onChange({...effects, vision: {...effects.vision, reveal: e.target.checked}})} /><span className="checkbox-custom"></span><span style={{fontSize: 12}}>Revela Enemigos</span></label>
        </div>
      )}
    </div>
  );
}

function GeometryEditor({
  prefixLabel, type, radius, width, length, onTypeChange, onRadiusChange, onWidthChange, onLengthChange
}: any) {
  return (
    <div style={{ marginTop: 16, padding: 12, background: "rgba(255,255,255,0.05)", borderRadius: 8 }}>
      <h4 style={{fontSize: 14, marginBottom: 8}}>Geometría ({prefixLabel})</h4>
      <select className="input-field" style={{marginBottom: 8}} value={type} onChange={e => onTypeChange(e.target.value)}>
        <option value="none">Ninguna</option>
        <option value="circle">Círculo / Esfera</option>
        <option value="rectangle">Rectángulo</option>
        <option value="line">Línea</option>
        <option value="cone">Cono</option>
      </select>
      {(type === "circle" || type === "cone") && (
        <div className="form-group">
          <label style={{fontSize: 12}}>Radio</label>
          <input type="number" className="input-field" value={radius} onChange={e => onRadiusChange(Number(e.target.value))} />
        </div>
      )}
      {(type === "rectangle" || type === "line") && (
        <div style={{display: "flex", gap: 8}}>
          <div className="form-group" style={{flex: 1}}>
            <label style={{fontSize: 12}}>Ancho</label>
            <input type="number" className="input-field" value={width} onChange={e => onWidthChange(Number(e.target.value))} />
          </div>
          <div className="form-group" style={{flex: 1}}>
            <label style={{fontSize: 12}}>Largo</label>
            <input type="number" className="input-field" value={length} onChange={e => onLengthChange(Number(e.target.value))} />
          </div>
        </div>
      )}
    </div>
  );
}
`;

const finalFile = head + funcBody + layoutHeader + formJSX + tail;

fs.writeFileSync('src/components/AgentSkillsManager.tsx', finalFile, 'utf8');
console.log('Rebuilt successfully!');
