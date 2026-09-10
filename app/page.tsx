"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NearbyExplorer from "@/components/NearbyExplorer";
import LegacyRoutes from "@/components/LegacyRoutes";
export default function Home() {
  return <Tabs defaultValue="nearby"><nav className="feature-nav" aria-label="경로 비교 기능"><TabsList><TabsTrigger value="nearby">주변 장소 찾기</TabsTrigger><TabsTrigger value="legacy">저장 매장 · 특정 주소 길찾기</TabsTrigger></TabsList></nav><TabsContent value="nearby"><NearbyExplorer/></TabsContent><TabsContent value="legacy"><LegacyRoutes/></TabsContent></Tabs>;
}
