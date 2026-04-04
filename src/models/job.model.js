const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
  employerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: String,
  requiredSkills: [String],
  wage: {
    type: Number
  },
  jobType: {
    type: String,
    enum: ["hourly", "daily", "contract"]
  },
  location: {
    address: String,
    type: {
      type: String,
      enum: ["Point"],
      default: "Point"
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  status: {
    type: String,
    enum: ["open", "in-progress", "completed"],
    default: "open"
  },
  hiredWorker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  applicants: [
    {
      workerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      appliedAt: {
        type: Date,
        default: Date.now
      },
      status: {
        type: String,
        enum: ["applied", "hired", "rejected"],
        default: "applied"
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

jobSchema.index({ location: "2dsphere", status: 1 });

module.exports = mongoose.model("Job", jobSchema);
