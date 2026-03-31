# rf-anomaly-detector
# 📡 RF Signal Anomaly Detector
🌐 **Live Demo:** [Click Here](https://rf-anomaly-detector.vercel.app)

> Real-time RF signal anomaly detection — software simulation of an FPGA-based autoencoder project

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![Recharts](https://img.shields.io/badge/Recharts-Visualization-FF6384?style=flat-square)
![Status](https://img.shields.io/badge/Status-Active-00ff88?style=flat-square)

## 🔍 Overview

This project is a **browser-based simulation** of an RF signal anomaly detection system. It visualizes real-time composite RF signals and flags anomalies using **Z-score statistical detection** — the same concept behind the reconstruction error in an autoencoder neural network.

This directly complements a hardware implementation of the same algorithm built on an **AMD Artix-7 FPGA using hand-coded Verilog**, presented at the **IEEE FPGA Hackathon 2026, BITS Pilani Hyderabad (sponsored by AMD)**.

---

## ✨ Features

- 📈 Real-time waveform visualization at 60 samples/sec
- 🧠 Z-score based anomaly detection (sliding window statistical analysis)
- ⚡ Manual anomaly injection to test detection
- 📉 Live reconstruction error (Z-score) plot
- 🎚️ Adjustable detection threshold
- 📋 Event log with timestamps

---

## 🧠 How It Works

```
Signal Generation → Sliding Window Stats → Z-Score Calculation → Threshold Check → Flag Anomaly
```

1. A **composite RF-like signal** is generated: sine wave + harmonics + Gaussian noise
2. A **sliding window** computes the local mean and standard deviation
3. The **Z-score** measures how far each sample is from the local mean (in standard deviations)
4. If Z-score exceeds the threshold (default: 2.8σ), the point is flagged as an **anomaly**

> This is mathematically equivalent to reconstruction error in an autoencoder — if the model can't "reconstruct" a signal well, it's likely an anomaly.

---

## 🔗 FPGA Connection

| Aspect | FPGA Implementation | This Project |
|---|---|---|
| Platform | AMD Artix-7 (Verilog/Vivado) | Browser (React) |
| Detection method | Autoencoder reconstruction error | Z-score statistical detection |
| Signal input | Real RF data | Synthetic composite signal |
| Purpose | Hardware inference | Algorithm visualization |

The FPGA version implements a hand-coded autoencoder in Verilog, achieving synthesis on the Artix-7 with successful behavioral simulation.

---

## 🚀 Getting Started

```bash
# Clone the repo
git clone https://github.com/uncertain0117/rf-anomaly-detector.git
cd rf-anomaly-detector

# Install dependencies
npm install
npm install recharts

# Run locally
npm run dev
```

---

## 🛠️ Tech Stack

- **React 18** — UI and real-time state management
- **Recharts** — Signal and Z-score visualization
- **Vite** — Build tool

---

## 👨‍💻 Author

**Sriram B** — ECE Student, Sri Sairam Engineering College, Tamil Nadu  
[GitHub](https://github.com/uncertain0117)

---

*Built as a software companion to an FPGA hardware project — bridging the gap between RTL design and interactive visualization.*

