"""
Route Models — Pydantic Schemas for /route
============================================
Defines the request and response shapes for route computation.

Used by:
  - routes/route.py for input validation and response serialization
  - services/routing_engine.py as the contract for compute()
"""

from pydantic import BaseModel, Field
from typing import Optional


class LatLng(BaseModel):
    """Geographic coordinate."""
    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lng: float = Field(..., ge=-180, le=180, description="Longitude")


class RouteRequest(BaseModel):
    """
    Input for a route computation.

    For single-modal: modes = ["car"]
    For multi-modal: modes = ["walk", "transit", "walk"]
    The order of modes defines the sequence of legs.
    """
    origin: LatLng
    destination: LatLng
    modes: list[str] = Field(
        ...,
        min_length=1,
        description="Ordered list of transport modes for each leg",
        examples=[["car"], ["walk", "transit", "walk"]],
    )
    optimize: str = Field(
        "time",
        description="Optimization criterion: 'time', 'distance', or 'cost'",
    )
    avoid_anomalies: bool = Field(
        True,
        description="Whether to avoid edges affected by active anomalies",
    )
    max_alternatives: Optional[int] = Field(
        None,
        description="Number of alternative routes to return (overrides config default)",
    )


class RouteLeg(BaseModel):
    """A single leg of a route (one transport mode)."""
    mode: str = Field(..., description="Transport mode for this leg")
    geometry: list[LatLng] = Field(
        default_factory=list,
        description="Ordered list of coordinates forming the leg polyline",
    )
    distance_m: float = Field(0.0, description="Leg distance in meters")
    duration_s: float = Field(0.0, description="Leg duration in seconds")
    cost: float = Field(0.0, description="Estimated cost for this leg")
    instructions: list[str] = Field(
        default_factory=list,
        description="Turn-by-turn navigation instructions",
    )


class ModeSwitch(BaseModel):
    """Represents a mode transfer point between two legs."""
    from_mode: str
    to_mode: str
    location: LatLng
    penalty_time_s: float = 0.0
    penalty_cost: float = 0.0


class RouteResponse(BaseModel):
    """Full response for a route computation."""
    legs: list[RouteLeg]
    mode_switches: list[ModeSwitch] = Field(default_factory=list)
    total_distance_m: float = 0.0
    total_duration_s: float = 0.0
    total_cost: float = 0.0
    anomalies_avoided: int = Field(
        0, description="Number of anomaly-affected edges bypassed"
    )
    alternatives: list[list[RouteLeg]] = Field(
        default_factory=list,
        description="Alternative route options",
    )
