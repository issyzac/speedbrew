-- Migration: Add comments column to orders table
-- Run this in your Supabase SQL Editor if you already have the orders table

ALTER TABLE orders ADD COLUMN IF NOT EXISTS comments text;
