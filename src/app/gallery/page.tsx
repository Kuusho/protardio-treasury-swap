"use client";

import GalleryPage from "~/components/GalleryPage";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function GalleryRoute() {
  const router = useRouter();
  const [fadeOut, setFadeOut] = useState(false);

  const handleBack = () => {
    // Start fade-out animation
    setFadeOut(true);
    // Wait for animation to complete before navigating
    setTimeout(() => {
      router.push("/");
    }, 500);
  };

  return (
    <div className={`h-screen ${fadeOut ? "page-fade-out" : "page-fade-in"}`}>
      <GalleryPage onBack={handleBack} />
    </div>
  );
}
