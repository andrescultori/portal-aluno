import { HashRouter, Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Login from './pages/Login'
import ManualDoAluno from './pages/ManualDoAluno'
import GoogleClassroom from './pages/GoogleClassroom'
import Calendario from './pages/Calendario'
import LinkSectionPage from './pages/LinkSectionPage'
import InfoPagePage from './pages/InfoPagePage'
import Presenca from './pages/Presenca'
import NotFound from './pages/NotFound'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsuarios from './pages/admin/AdminUsuarios'
import AdminTurmas from './pages/admin/AdminTurmas'
import AdminConteudo from './pages/admin/AdminConteudo'
import AdminRelatorio from './pages/admin/AdminRelatorio'

export default function App() {
  return (
    <HashRouter>
      <Header />
      <main className="flex-1">
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
            <Route path="usuarios" element={<AdminUsuarios />} />
            <Route path="turmas" element={<AdminTurmas />} />
            <Route path="conteudo" element={<AdminConteudo />} />
            <Route path="relatorio" element={<AdminRelatorio />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </HashRouter>
  )
}
