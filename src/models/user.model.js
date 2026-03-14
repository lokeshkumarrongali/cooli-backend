const mongoose = require('mongoose');
const { ROLES, PROVIDERS } = require('../utils/constants');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: function () {
        return this.provider === PROVIDERS.LOCAL;
      },
    },
    provider: {
      type: String,
      enum: Object.values(PROVIDERS),
      default: PROVIDERS.LOCAL,
    },
    providerId: {
      type: String,
      index: {
        unique: true,
        partialFilterExpression: { providerId: { $type: 'string' } },
      },
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.USER,
    },
    lastLogin: {
      type: Date,
    },
    refreshToken: {
      type: String,
    },
    sharedProfile: {
      name: String,
      phone: String,
      photo: String,
      bio: String,
      address: {
        houseNo: String,
        street: String,
        village: String,
        mandal: String,
        district: String,
        state: String,
        country: String,
        pincode: String,
        coordinates: {
          lat: Number,
          lng: Number
        }
      }
    },
    workerProfile: {
      location: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point"
        },
        coordinates: {
          type: [Number] // [longitude, latitude]
        }
      },
      skills: [String],
      experience: String,
      expectedWage: String,
      availability: {
        type: String,
        enum: ["available", "busy", "offline"],
        default: "available"
      },
      stats: {
        rating: { type: Number, default: 0 },
        totalReviews: { type: Number, default: 0 },
        jobsCompleted: { type: Number, default: 0 }
      },
      portfolio: [{
        type: { type: String, enum: ['image', 'certificate', 'link'] },
        url: String,
        title: String
      }]
    },
    employerProfile: {
      businessName: String,
      businessType: String,
      companyDescription: String,
      businessDocuments: [String],
      stats: {
        rating: { type: Number, default: 0 },
        totalReviews: { type: Number, default: 0 },
        jobsPosted: { type: Number, default: 0 },
        workersHired: { type: Number, default: 0 }
      }
    },
    savedJobs: [
      {
        jobId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Job',
        },
        savedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('User', userSchema);
