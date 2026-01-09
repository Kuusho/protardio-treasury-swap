"use client";

import MintPage from "~/components/MintPage";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export default function MintRoute() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [fadeOut, setFadeOut] = useState(false);

  const handleBack = () => {
    // Start fade-out animation
    setFadeOut(true);
    // Wait for animation to complete before navigating
    setTimeout(() => {
      router.push("/");
    }, 500);
  };

  const handleNavigateToGallery = () => {
    // Invalidate NFTs cache so gallery fetches fresh data
    queryClient.invalidateQueries({ queryKey: ["nfts"] });

    // Start fade-out animation
    setFadeOut(true);
    // Wait for animation to complete before navigating
    setTimeout(() => {
      router.push("/gallery");
    }, 500);
  };

  return (
    <div className={`h-screen ${fadeOut ? "page-fade-out" : "page-fade-in"}`}>
      <MintPage onBack={handleBack} onNavigateToGallery={handleNavigateToGallery} />
    </div>
  );
}
