import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import Shell from './components/Shell'
import ProtectedRoute from './components/ProtectedRoute'
import RestauraRolagem from './components/RestauraRolagem'
import Home from './pages/Home'
import Login from './pages/Login'
import ManualDoAluno from './pages/ManualDoAluno'
import GoogleClassroom from './pages/GoogleClassroom'
import Calendario from './pages/Calendario'
import LinkSectionPage from './pages/LinkSectionPage'
import InfoPagePage from './pages/InfoPagePage'
import Presenca from './pages/Presenca'
import Avaliar from './pages/Avaliar'
import AvaliarForm from './pages/AvaliarForm'
import NotFound from './pages/NotFound'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsuarios from './pages/admin/AdminUsuarios'
import AdminTurmasAlunos from './pages/admin/AdminTurmasAlunos'
import AdminAluno from './pages/admin/AdminAluno'
import AdminResultados from './pages/admin/AdminResultados'
import AdminConteudo from './pages/admin/AdminConteudo'
import AdminRelatorio from './pages/admin/AdminRelatorio'
import AdminAvisos from './pages/admin/AdminAvisos'
import AdminAvaliacoes from './pages/admin/AdminAvaliacoes'

// Quem pode abrir as telas de avaliação (a autorização real é do banco, por atribuição).
const PAPEIS_AVALIADORES = ['tutor', 'mentor', 'lider_casa']

function RedirecionaAvaliar() {
  const { categoria, alunoId } = useParams()
  return <Navigate to={`/admin/avaliar/${categoria}/${alunoId}`} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <RestauraRolagem />
      <Shell>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manual"
            element={
              <ProtectedRoute>
                <ManualDoAluno />
              </ProtectedRoute>
            }
          />
          <Route
            path="/classroom"
            element={
              <ProtectedRoute>
                <GoogleClassroom />
              </ProtectedRoute>
            }
          />
          <Route
            path="/calendario"
            element={
              <ProtectedRoute>
                <Calendario />
              </ProtectedRoute>
            }
          />
          <Route
            path="/presenca"
            element={
              <ProtectedRoute>
                <Presenca />
              </ProtectedRoute>
            }
          />
          {/* Endereços antigos da avaliação: agora ficam dentro do Admin (com o menu lateral). */}
          <Route path="/avaliar" element={<Navigate to="/admin/avaliar" replace />} />
          <Route path="/avaliar/:categoria/:alunoId" element={<RedirecionaAvaliar />} />
          <Route
            path="/links/:sectionId"
            element={
              <ProtectedRoute>
                <LinkSectionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/paginas/:slug"
            element={
              <ProtectedRoute>
                <InfoPagePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute papel="equipe">
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route
              path="usuarios"
              element={
                <ProtectedRoute papeis={['admin', 'coordenacao']}>
                  <AdminUsuarios />
                </ProtectedRoute>
              }
            />
            <Route path="turmas" element={<AdminTurmasAlunos />} />
            <Route path="alunos/:id" element={<AdminAluno />} />
            <Route
              path="resultados"
              element={
                <ProtectedRoute papeis={['admin', 'coordenacao']}>
                  <AdminResultados />
                </ProtectedRoute>
              }
            />
            <Route path="conteudo" element={<AdminConteudo />} />
            <Route path="relatorio" element={<AdminRelatorio />} />
            <Route
              path="avaliar"
              element={
                <ProtectedRoute papeis={PAPEIS_AVALIADORES}>
                  <Avaliar />
                </ProtectedRoute>
              }
            />
            <Route
              path="avaliar/:categoria/:alunoId"
              element={
                <ProtectedRoute papeis={PAPEIS_AVALIADORES}>
                  <AvaliarForm />
                </ProtectedRoute>
              }
            />
            <Route path="avisos" element={<AdminAvisos />} />
            <Route
              path="avaliacoes"
              element={
                <ProtectedRoute papeis={['admin', 'coordenacao']}>
                  <AdminAvaliacoes />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  )
}
