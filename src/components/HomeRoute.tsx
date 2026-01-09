"use client";

import MainContent from "~/components/MainContent";
import ConnectScreen from "~/components/ConnectScreen";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAccount } from "wagmi";

export default function HomeRoute() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const [fadeOut, setFadeOut] = useState(false);
  const [showMainContent, setShowMainContent] = useState(false);

  const handleMintClick = () => {
    setFadeOut(true);
    setTimeout(() => {
      router.push("/mint");
    }, 500);
  };

  const handleGalleryClick = () => {
    setFadeOut(true);
    setTimeout(() => {
      router.push("/gallery");
    }, 500);
  };

  const handleConnected = () => {
    setShowMainContent(true);
  };

  // Show ConnectScreen if not connected and haven't manually proceeded
  if (!isConnected && !showMainContent) {
    return (
      <div className="page-fade-in">
        <ConnectScreen onConnected={handleConnected} />
      </div>
    );
  }

  return (
    <div className={fadeOut ? "page-fade-out" : "page-fade-in"}>
      <MainContent onMintClick={handleMintClick} onGalleryClick={handleGalleryClick} />
    </div>
  );
}
