import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { hojeISO } from './datas'
import type { AllowedUser, AttendanceRecord, Turma } from '../types/database'

export interface PresencaHoje {
  carregando: boolean
  turma: Turma | null
  registro: AttendanceRecord | null
}

// Só leitura (RLS): turma do aluno e o registro de presença de hoje, se existir.
// Quem decide se a janela está aberta continua sendo a Edge Function.
export function usePresencaHoje(perfil: AllowedUser | null): PresencaHoje {
  const [estado, setEstado] = useState<PresencaHoje>({
    carregando: true,
    turma: null,
    registro: null,
  })

  useEffect(() => {
    if (!perfil) return
    let cancelado = false

    async function carregar(p: AllowedUser) {
      const [turmaRes, registroRes] = await Promise.all([
        p.turma_id
          ? supabase
              .from('turmas')
              .select('id, nome, horario_inicio, horario_fim_presente, horario_fim_atraso, ativo')
              .eq('id', p.turma_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from('attendance_records')
          .select('*')
          .eq('aluno_id', p.id)
          .eq('data', hojeISO())
          .maybeSingle(),
      ])
      if (cancelado) return
      setEstado({
        carregando: false,
        turma: (turmaRes.data as Turma | null) ?? null,
        registro: (registroRes.data as AttendanceRecord | null) ?? null,
      })
    }

    carregar(perfil)
    return () => {
      cancelado = true
    }
  }, [perfil])

  return estado
}
