"use client"

import { useState, useCallback } from "react"
import { Slider } from "@/components/ui/slider"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { HelpCircle } from "lucide-react"

interface PricingSliderProps {
  onChange?: (price: number) => void
}

const BASE_PRICE = 0.59 // RTX 4090 base price anchor $/hr

export function PricingSlider({ onChange }: PricingSliderProps) {
  const [price, setPrice] = useState(BASE_PRICE)

  const handleChange = useCallback(
    (value: number[]) => {
      const v = +(value[0].toFixed(2))
      setPrice(v)
      onChange?.(v)
    },
    [onChange]
  )

  // v3.2: Miner Revenue (95%), 5% split — 2.5% hard asset (BTC/SOL), 2.5% Eco-Pool (anti-volatility)
  const minerRevenue = +(price * 0.95).toFixed(4)
  const hardAssetAnchor = +(price * 0.025).toFixed(4)
  const ecoPoolBuffer = +(price * 0.025).toFixed(4)

  return (
    <div
      className="border border-border"
      style={{ backgroundColor: "var(--terminal-bg)" }}
    >
      <div
        className="flex items-center justify-between border-b border-border px-4 py-2"
        style={{ backgroundColor: "rgba(0,255,65,0.03)" }}
      >
        <span className="text-xs uppercase tracking-wider" style={{ color: "#00cc33" }}>
          Pricing Configuration
        </span>
        <span className="text-xs" style={{ color: "rgba(0,255,65,0.4)" }}>
          Per Hour Rate
        </span>
      </div>

      <div className="flex flex-col gap-6 p-6">
        {/* Price display */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-3xl font-bold" style={{ color: "#00FFFF" }}>
            ${price.toFixed(2)}/hr
          </span>
          <span className="text-xs" style={{ color: "rgba(0,255,255,0.5)" }}>
            Drag slider to set your compute price
          </span>
        </div>

        {/* Slider */}
        <div className="px-2">
          <Slider
            value={[price]}
            min={0.10}
            max={2.00}
            step={0.01}
            onValueChange={handleChange}
          />
          <div className="mt-2 flex justify-between text-xs" style={{ color: "rgba(0,255,65,0.3)" }}>
            <span>$0.10</span>
            <span>$2.00</span>
          </div>
        </div>

        {/* Fee breakdown: v3.2 — Miner 95%, 2.5% hard asset + 2.5% Eco-Pool */}
        <div
          className="flex flex-col gap-2 border border-border p-4"
          style={{ backgroundColor: "rgba(0,255,65,0.02)" }}
        >
          <span className="mb-1 text-xs uppercase tracking-wider" style={{ color: "rgba(0,255,65,0.5)" }}>
            5% Fee Breakdown
          </span>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2" style={{ backgroundColor: "#00FF41" }} />
              <span className="text-xs" style={{ color: "rgba(0,255,65,0.6)" }}>
                Miner Revenue (95%)
              </span>
            </div>
            <span className="text-sm font-bold" style={{ color: "#00FF41" }}>
              ${minerRevenue}/hr
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2" style={{ backgroundColor: "#F7931A" }} />
              <span className="text-xs" style={{ color: "rgba(247,147,26,0.9)" }}>
                Hard Asset Anchor (2.5%)
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle
                    className="h-3 w-3 cursor-help opacity-60 hover:opacity-100"
                    style={{ color: "#00FF41" }}
                  />
                </TooltipTrigger>
                <TooltipContent
                  className="max-w-[240px] border"
                  style={{ backgroundColor: "var(--terminal-bg)", borderColor: "rgba(0,255,65,0.3)" }}
                >
                  <p className="text-xs" style={{ color: "#00FF41" }}>
                    2.5% for BTC/SOL floor backing.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <span className="text-sm font-bold" style={{ color: "#F7931A" }}>
              ${hardAssetAnchor}/hr
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2" style={{ backgroundColor: "#00FFFF" }} />
              <span className="text-xs" style={{ color: "rgba(0,255,255,0.6)" }}>
                Eco-Pool Buffer (2.5%)
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle
                    className="h-3 w-3 cursor-help opacity-60 hover:opacity-100"
                    style={{ color: "#00FF41" }}
                  />
                </TooltipTrigger>
                <TooltipContent
                  className="max-w-[240px] border"
                  style={{ backgroundColor: "var(--terminal-bg)", borderColor: "rgba(0,255,65,0.3)" }}
                >
                  <p className="text-xs" style={{ color: "#00FF41" }}>
                    2.5% for Eco-Pool to counter liquidity volatility.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <span className="text-sm font-bold" style={{ color: "#00FFFF" }}>
              ${ecoPoolBuffer}/hr
            </span>
          </div>

          {/* Visual bar */}
          <div className="mt-2 flex h-2 overflow-hidden">
            <div style={{ width: "95%", backgroundColor: "#00FF41" }} />
            <div style={{ width: "2.5%", backgroundColor: "#F7931A" }} />
            <div style={{ width: "2.5%", backgroundColor: "#00FFFF" }} />
          </div>
        </div>
      </div>
    </div>
  )
}
