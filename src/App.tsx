import { AnimatePresence } from "motion/react";
import { useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { ApiError, useMe, type RecordType } from "./api";
import { AddRecordSheet } from "./components/AddRecordSheet";
import { DogAgent } from "./components/DogAgent";
import { AlbumSkeleton, FormSkeleton, HomeSkeleton, LoginSkeleton, SettingsSkeleton, StatsSkeleton } from "./components/Skeletons";
import { TabBar } from "./components/TabBar";
import { DogProvider, useCurrentDog } from "./dogContext";
import Album from "./pages/Album";
import DogForm from "./pages/DogForm";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Settings from "./pages/Settings";
import Stats from "./pages/Stats";

function RouteSkeleton({ path }: { path: string }) {
  if (path === "/login") return <LoginSkeleton />;
  if (path.startsWith("/stats")) return <StatsSkeleton />;
  if (path.startsWith("/album")) return <AlbumSkeleton />;
  if (path.startsWith("/settings")) return <SettingsSkeleton />;
  if (path.startsWith("/dogs")) return <FormSkeleton />;
  return <HomeSkeleton />;
}

export default function App() {
  const me = useMe();
  const loc = useLocation();

  if (me.isPending) return <RouteSkeleton path={loc.pathname} />;
  if (me.error) {
    if (me.error instanceof ApiError && me.error.status === 401) {
      return loc.pathname === "/login" ? <Login /> : <Navigate to="/login" replace />;
    }
    return <RouteSkeleton path={loc.pathname} />;
  }
  if (loc.pathname === "/login") return <Navigate to="/" replace />;

  return (
    <DogProvider>
      <Authed />
    </DogProvider>
  );
}

const TAB_PATHS = ["/", "/stats", "/album", "/settings"];

function Authed() {
  const loc = useLocation();
  const { dogs, loading } = useCurrentDog();
  const [sheet, setSheet] = useState<{ open: boolean; type?: RecordType }>({ open: false });
  const openAdd = (type?: RecordType) => setSheet({ open: true, type });

  if (loading) return <RouteSkeleton path={loc.pathname} />;
  if (dogs.length === 0) return <DogForm first />;

  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        <Routes location={loc} key={loc.pathname}>
          <Route path="/" element={<Home onAdd={openAdd} />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/album" element={<Album onAdd={() => openAdd("diary")} />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/dogs/new" element={<DogForm />} />
          <Route path="/dogs/:id" element={<DogForm />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
      <DogAgent />
      {TAB_PATHS.includes(loc.pathname) && <TabBar onAdd={() => openAdd()} />}
      <AddRecordSheet open={sheet.open} initialType={sheet.type} onClose={() => setSheet({ open: false })} />
    </>
  );
}
