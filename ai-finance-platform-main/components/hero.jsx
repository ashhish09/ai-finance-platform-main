"use client";

import React, { useEffect, useRef } from "react";
import Image from "next/image";

const HeroSection = () => {
  const imageRef = useRef(null);

  useEffect(() => {
    const imageElement = imageRef.current;

    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      const scrollThreshold = 100;

      if (scrollPosition > scrollThreshold) {
        imageElement.classList.add("scrolled");
      } else {
        imageElement.classList.remove("scrolled");
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section className="pt-36 pb-16 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),transparent_55%)]" />
      <div className="container mx-auto text-center">
        <h1 className="text-5xl md:text-7xl lg:text-8xl pb-4 gradient-title">
          MoneyMind <br /> Financial AI OS
        </h1>
        <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          Track spending, forecast monthly risk, discover products under your budget,
          and get personalized AI coaching in one immersive dashboard.
        </p>
        <div className="flex justify-center gap-3 mb-8">
          <span className="rounded-full border px-4 py-2 text-sm bg-white">100+ AI Experiences</span>
          <span className="rounded-full border px-4 py-2 text-sm bg-white">Balance Aware</span>
          <span className="rounded-full border px-4 py-2 text-sm bg-white">Model Suggestions</span>
        </div>
        <div className="hero-image-wrapper mt-2 md:mt-0">
          <div ref={imageRef} className="hero-image">
            <Image
              src="/banner.jpeg?v=2"
              width={1280}
              height={720}
              alt="Dashboard Preview"
              className="rounded-lg shadow-2xl border mx-auto"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
