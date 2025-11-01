# SPDX-License-Identifier: MIT
"""
Backend application package for Nexus Quantum I2A2.

This module exposes helpers to create the FastAPI application instance
and ensures the package is treated as a regular Python module.
"""

from .main import create_app

__all__ = ["create_app"]
