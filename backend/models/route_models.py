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


class VehicleOption(BaseModel):
    """Vehicle option for a route segment with travel time estimate."""
    vehicle: str = Field(..., description="Vehicle type (car, bike, walk, transit, rickshaw)")
    travel_time_s: float = Field(..., description="Estimated travel time in seconds for this segment")
    is_recommended: bool = Field(False, description="Whether this is the fastest vehicle for this segment")
    distance_m: float = Field(0.0, description="Distance of the segment in meters")


class SegmentSuggestion(BaseModel):
    """Vehicle suggestions for a single route segment/edge."""
    segment_index: int = Field(..., description="Index of the segment in the route")
    from_node: Optional[str] = Field(None, description="Start node ID")
    to_node: Optional[str] = Field(None, description="End node ID")
    distance_m: float = Field(..., description="Distance of this segment")
    road_type: Optional[str] = Field(None, description="OSM road type")
    vehicle_options: list[VehicleOption] = Field(default_factory=list, description="Available vehicles for this segment")
    recommended_vehicle: str = Field(..., description="Fastest vehicle for this segment")


class PathWithVehicleSuggestions(BaseModel):
    """A route path with vehicle suggestions per segment."""
    route_type: str = Field(..., description="'shortest_distance' or 'fastest_time'")
    total_distance_m: float = Field(0.0, description="Total distance in meters")
    total_duration_s: float = Field(0.0, description="Total duration in seconds with optimal vehicle choices")
    geometry: list[LatLng] = Field(default_factory=list, description="Complete route polyline")
    segments: list[SegmentSuggestion] = Field(default_factory=list, description="Vehicle suggestions per segment")
    legs: list["RouteLeg"] = Field(default_factory=list, description="Full legs data")


class PathWithVehicleSuggestions(BaseModel):
    """A route path with vehicle suggestions per segment."""
    route_type: str = Field(..., description="'shortest_distance' or 'fastest_time'")
    total_distance_m: float = Field(0.0, description="Total distance in meters")
    total_duration_s: float = Field(0.0, description="Total duration in seconds with optimal vehicle choices")
    geometry: list[LatLng] = Field(default_factory=list, description="Complete route polyline")
    segments: list[SegmentSuggestion] = Field(default_factory=list, description="Vehicle suggestions per segment")
    legs: list["RouteLeg"] = Field(default_factory=list, description="Full legs data")


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
    multimodal_suggestions: Optional[list[PathWithVehicleSuggestions]] = Field(
        default=None,
        description="Vehicle suggestions for shortest distance and fastest time routes",
    )
