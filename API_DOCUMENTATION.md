# Jikanzo Backend API Documentation

This document outlines the API endpoints available in the backend.

## POST /user/send-otp
**Summary**: Send OTP to user phone

**Tags**: Auth

### Request Body
```json
{
  "$ref": "#/components/schemas/SendOtpRequest"
}
```

### Responses
- **200**: OTP sent
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/MessageResponse"
  }
  ```
- **400**: Validation Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **500**: Internal Server Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```

---

## POST /user/login
**Summary**: Login user with OTP

**Tags**: Auth

### Request Body
```json
{
  "$ref": "#/components/schemas/VerifyOtpRequest"
}
```

### Responses
- **200**: Login successful
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/AuthTokenResponse"
  }
  ```
- **401**: Invalid OTP
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **404**: User not found
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **500**: Internal Server Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```

---

## POST /user/verify-otp
**Summary**: Verify OTP for user phone

**Tags**: Auth

### Request Body
```json
{
  "$ref": "#/components/schemas/VerifyOtpRequest"
}
```

### Responses
- **200**: OTP verified successfully
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/VerifyOtpResponse"
  }
  ```
- **400**: Invalid or expired OTP
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **404**: OTP request not found
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **500**: Internal Server Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```

---

## POST /user/register
**Summary**: Register a new user (Requires verified phone number)

**Tags**: Auth

### Request Body
```json
{
  "$ref": "#/components/schemas/RegisterRequest"
}
```

### Responses
- **201**: User registered successfully
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/AuthTokenResponse"
  }
  ```
- **400**: Validation Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **403**: Phone number not verified
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **409**: Username or phone already taken
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **500**: Internal Server Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```

---

## POST /user/upload-image
**Summary**: Upload a single image to Cloudflare R2

**Tags**: User

### Responses
- **200**: Image uploaded successfully
  **Response Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "status": {
        "type": "boolean"
      },
      "msg": {
        "type": "string"
      },
      "url": {
        "type": "string"
      }
    }
  }
  ```
- **400**: Bad Request
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **500**: Internal Server Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```

---

## POST /user/upload-video
**Summary**: Upload a single video to Cloudflare R2 and add to intros

**Tags**: User

### Responses
- **200**: Video uploaded successfully
  **Response Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "status": {
        "type": "boolean"
      },
      "msg": {
        "type": "string"
      },
      "url": {
        "type": "string"
      }
    }
  }
  ```
- **400**: Bad Request
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **401**: Unauthorized - Missing or Invalid Token
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **500**: Internal Server Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```

---

## POST /user/upload-gallery
**Summary**: Update the user's gallery with an array of image URLs

**Tags**: User

### Request Body
```json
{
  "type": "object",
  "properties": {
    "images": {
      "type": "array",
      "items": {
        "type": "string",
        "format": "uri"
      }
    }
  },
  "required": [
    "images"
  ]
}
```

### Responses
- **200**: Gallery updated successfully
  **Response Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "status": {
        "type": "boolean"
      },
      "msg": {
        "type": "string"
      },
      "urls": {
        "type": "array",
        "items": {
          "type": "string",
          "format": "uri"
        }
      }
    }
  }
  ```
- **400**: Bad Request
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **401**: Unauthorized - Missing or Invalid Token
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **500**: Internal Server Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```

---

## GET /discover/people
**Summary**: Discover people near you

**Tags**: User

### Parameters
| Name | In | Required | Type |
| ---- | -- | -------- | ---- |
| `lat` | query | Yes | number |
| `lng` | query | Yes | number |
| `radius` | query | No | number |

### Responses
- **200**: People discovered successfully
  **Response Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "status": {
        "type": "boolean"
      },
      "msg": {
        "type": "string"
      },
      "data": {
        "type": "array",
        "items": {
          "$ref": "#/components/schemas/CompanionDto"
        }
      }
    }
  }
  ```
- **400**: Bad Request
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **500**: Internal Server Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```

---

## GET /feed/get-feed
**Summary**: Get all companions with filtering options

**Tags**: Feed

### Parameters
| Name | In | Required | Type |
| ---- | -- | -------- | ---- |
| `search` | query | No | string |
| `trustRank` | query | No | string |
| `rating` | query | No | number |
| `minPrice` | query | No | number |
| `maxPrice` | query | No | number |
| `limit` | query | No | integer |
| `page` | query | No | integer |

### Responses
- **200**: Companions fetched successfully
  **Response Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "status": {
        "type": "boolean"
      },
      "msg": {
        "type": "string"
      },
      "data": {
        "type": "array",
        "items": {
          "$ref": "#/components/schemas/CompanionDto"
        }
      },
      "pagination": {
        "type": "object",
        "properties": {
          "total": {
            "type": "integer"
          },
          "page": {
            "type": "integer"
          },
          "limit": {
            "type": "integer"
          },
          "totalPages": {
            "type": "integer"
          }
        }
      }
    }
  }
  ```
- **500**: Internal Server Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```

---

## GET /feed/specific/{userId}
**Summary**: Get specific companion profile with analytics and reviews

**Tags**: Feed

### Parameters
| Name | In | Required | Type |
| ---- | -- | -------- | ---- |
| `userId` | path | Yes | integer |

### Responses
- **200**: Companion fetched successfully
  **Response Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "status": {
        "type": "boolean"
      },
      "msg": {
        "type": "string"
      },
      "data": {
        "type": "object",
        "properties": {
          "id": {
            "type": "integer"
          },
          "bio": {
            "type": "string"
          },
          "hourlyRate": {
            "type": "number"
          },
          "locationLat": {
            "type": "number"
          },
          "locationLng": {
            "type": "number"
          },
          "isOnline": {
            "type": "boolean"
          },
          "rating": {
            "type": "number"
          },
          "trustRank": {
            "type": "string"
          },
          "isSaved": {
            "type": "boolean"
          },
          "user": {
            "type": "object",
            "properties": {
              "username": {
                "type": "string"
              },
              "profileImage": {
                "type": "string"
              },
              "age": {
                "type": "integer"
              },
              "gender": {
                "type": "string"
              },
              "about": {
                "type": "string"
              },
              "languages": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "activityType": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "gallery": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "intros": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            }
          },
          "reviews": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "integer"
                },
                "rating": {
                  "type": "number"
                },
                "comment": {
                  "type": "string"
                },
                "createdAt": {
                  "type": "string",
                  "format": "date-time"
                },
                "client": {
                  "type": "object",
                  "properties": {
                    "id": {
                      "type": "integer"
                    },
                    "username": {
                      "type": "string"
                    },
                    "profileImage": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "momentsAnalytics": {
            "type": "object",
            "properties": {
              "totalLikes": {
                "type": "integer"
              },
              "totalRings": {
                "type": "integer"
              },
              "totalDiamonds": {
                "type": "integer"
              }
            }
          },
          "performance": {
            "type": "object",
            "properties": {
              "rating": {
                "type": "number"
              },
              "totalSessions": {
                "type": "integer"
              },
              "repeatClients": {
                "type": "integer"
              },
              "repeatRate": {
                "type": "string"
              }
            }
          }
        }
      }
    }
  }
  ```
- **401**: Unauthorized - Missing or Invalid Token
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **404**: Companion not found
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **500**: Internal Server Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```

---

## PUT /user/update-profile
**Summary**: Update user profile

**Tags**: User

### Request Body
```json
{
  "$ref": "#/components/schemas/UpdateProfileRequest"
}
```

### Responses
- **200**: Profile updated successfully
  **Example Response**:
  ```json
  {
    "status": true,
    "msg": "Profile updated successfully"
  }
  ```
- **400**: Validation Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **500**: Internal Server Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```

---

## GET /user/whoami
**Summary**: Get current logged in user details

**Tags**: User

### Responses
- **200**: User details fetched successfully
  **Example Response**:
  ```json
  {
    "status": true,
    "msg": "User profile fetched successfully",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "username": "traveler_jane",
      "phone": "+1234567890",
      "role": "USER",
      "profileImage": "https://cdn.jikanzo.com/users/jane_profile_pic.jpg",
      "about": "Hi, I am a professional companion who loves traveling and meeting new people!",
      "languages": [
        "English",
        "Japanese"
      ],
      "activityType": [
        "Dinner",
        "City Tour",
        "Event Companion"
      ],
      "savedLocations": [
        {
          "name": "Tokyo Tower",
          "lat": 35.6586,
          "lng": 139.7454
        }
      ],
      "gender": "Female",
      "age": 24,
      "walletBalance": 0,
      "gallery": [
        "https://cdn.jikanzo.com/users/jane_gallery_1.jpg"
      ],
      "intros": [
        "https://cdn.jikanzo.com/users/jane_intro_video.mp4"
      ],
      "profileProgress": 100
    }
  }
  ```
- **404**: User not found
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **500**: Internal Server Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```

---

## GET /user/check-progress
**Summary**: Check Profile Verification Progress

**Tags**: User

### Responses
- **200**: Profile progress calculated
  **Example Response**:
  ```json
  {
    "status": true,
    "msg": "Profile progress calculated",
    "data": {
      "percentage": 100,
      "completedFields": 8,
      "totalFields": 8
    }
  }
  ```
- **404**: User not found
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **500**: Internal Server Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```

---

## POST /booking/book-companion/{id}
**Summary**: Book a companion

**Tags**: Booking

### Parameters
| Name | In | Required | Type |
| ---- | -- | -------- | ---- |
| `id` | path | Yes | integer |

### Request Body
```json
{
  "type": "object",
  "properties": {
    "date": {
      "type": "string",
      "format": "date-time"
    },
    "startTime": {
      "type": "string",
      "format": "date-time"
    },
    "endTime": {
      "type": "string",
      "format": "date-time"
    },
    "latitude": {
      "type": "number"
    },
    "longitude": {
      "type": "number"
    },
    "address": {
      "type": "string"
    }
  },
  "required": [
    "date",
    "startTime",
    "endTime",
    "latitude",
    "longitude"
  ]
}
```

### Responses
- **201**: Booking created successfully
  **Example Response**:
  ```json
  {
    "status": true,
    "msg": "Booking request created successfully",
    "data": {
      "id": 1,
      "clientId": 12,
      "companionId": 5,
      "date": "2024-11-20T00:00:00.000Z",
      "startTime": "2024-11-20T18:00:00.000Z",
      "endTime": "2024-11-20T22:00:00.000Z",
      "status": "PENDING"
    }
  }
  ```
- **400**: Validation Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **404**: Companion not found
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **500**: Internal Server Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```

---

## POST /booking/accept
**Summary**: Accept or decline a booking

**Tags**: Booking

### Request Body
```json
{
  "type": "object",
  "properties": {
    "bookingId": {
      "type": "integer"
    },
    "action": {
      "type": "string",
      "enum": [
        "ACCEPT",
        "DECLINE",
        "CANCEL"
      ]
    }
  },
  "required": [
    "bookingId",
    "action"
  ]
}
```

### Responses
- **200**: Booking status updated successfully
  **Example Response**:
  ```json
  {
    "status": true,
    "msg": "Booking accepted successfully"
  }
  ```
- **400**: Validation Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **404**: Booking not found
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **500**: Internal Server Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```

---

## POST /booking/complete
**Summary**: Complete a booking

**Tags**: Booking

### Request Body
```json
{
  "type": "object",
  "properties": {
    "bookingId": {
      "type": "integer"
    },
    "otp": {
      "type": "string"
    }
  },
  "required": [
    "bookingId",
    "otp"
  ]
}
```

### Responses
- **200**: Booking status updated to COMPLETED successfully
  **Example Response**:
  ```json
  {
    "status": true,
    "msg": "Booking completed successfully",
    "data": {
      "id": 1,
      "status": "COMPLETED"
    }
  }
  ```
- **400**: Validation Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **404**: Booking not found
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **500**: Internal Server Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```

---

## POST /booking/pay-with-wallet
**Summary**: Pay for a booking with wallet balance

**Tags**: Booking

### Request Body
```json
{
  "type": "object",
  "properties": {
    "bookingId": {
      "type": "integer"
    }
  },
  "required": [
    "bookingId"
  ]
}
```

### Responses
- **200**: Payment successful
  **Example Response**:
  ```json
  {
    "status": true,
    "msg": "Payment successful"
  }
  ```
- **400**: Validation Error or Insufficient funds
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **404**: Booking not found
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **500**: Internal Server Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```

---

## POST /feed/impression
**Summary**: Log an impression for a companion card

**Tags**: Feed

### Request Body
```json
{
  "$ref": "#/components/schemas/LogImpressionRequest"
}
```

### Responses
- **200**: Impression logged successfully
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/MessageResponse"
  }
  ```
- **400**: Validation Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **500**: Internal Server Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```

---

## POST /feed/save-companion
**Summary**: Toggle saving a companion

**Tags**: Feed

### Request Body
```json
{
  "$ref": "#/components/schemas/SaveCompanionRequest"
}
```

### Responses
- **200**: Companion saved/unsaved successfully
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/MessageResponse"
  }
  ```
- **400**: Validation Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **404**: Companion not found
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **500**: Internal Server Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```

---

## GET /feed/saved-companions
**Summary**: Get all saved companions for the user

**Tags**: Feed

### Responses
- **200**: Fetched successfully
  **Response Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "status": {
        "type": "boolean"
      },
      "msg": {
        "type": "string"
      },
      "data": {
        "type": "array",
        "items": {
          "$ref": "#/components/schemas/CompanionDto"
        }
      }
    }
  }
  ```
- **500**: Internal Server Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```

---

## POST /moments/create
**Summary**: Create a new moment (Story)

**Tags**: Moments

### Request Body
```json
{
  "$ref": "#/components/schemas/CreateMomentRequest"
}
```

### Responses
- **201**: Moment created successfully
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/MessageResponse"
  }
  ```
- **400**: Validation Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **403**: Unauthorized
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **500**: Internal Server Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```

---

## GET /moments/feed
**Summary**: Get active moments feed

**Tags**: Moments

### Parameters
| Name | In | Required | Type |
| ---- | -- | -------- | ---- |
| `type` | query | No | string |
| `lat` | query | No | number |
| `lng` | query | No | number |
| `radius` | query | No | number |
| `page` | query | No | integer |
| `limit` | query | No | integer |

### Responses
- **200**: Fetched successfully
  **Response Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "status": {
        "type": "boolean"
      },
      "data": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "companionId": {
              "type": "integer"
            },
            "username": {
              "type": "string"
            },
            "profileImage": {
              "type": "string"
            },
            "allSeen": {
              "type": "boolean"
            },
            "moments": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "momentId": {
                    "type": "integer"
                  },
                  "mediaUrl": {
                    "type": "string"
                  },
                  "caption": {
                    "type": "string",
                    "nullable": true
                  },
                  "createdAt": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "expiresAt": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "isSeen": {
                    "type": "boolean"
                  },
                  "likes": {
                    "type": "integer"
                  },
                  "diamonds": {
                    "type": "integer"
                  },
                  "rings": {
                    "type": "integer"
                  }
                }
              }
            }
          }
        }
      },
      "pagination": {
        "type": "object",
        "properties": {
          "total": {
            "type": "integer"
          },
          "page": {
            "type": "integer"
          },
          "limit": {
            "type": "integer"
          },
          "totalPages": {
            "type": "integer"
          }
        }
      }
    }
  }
  ```
- **500**: Internal Server Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```

---

## DELETE /moments/{id}
**Summary**: Delete a moment

**Tags**: Moments

### Parameters
| Name | In | Required | Type |
| ---- | -- | -------- | ---- |
| `id` | path | Yes | integer |

### Responses
- **200**: Moment deleted successfully
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/MessageResponse"
  }
  ```
- **403**: Unauthorized
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **404**: Moment not found
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **500**: Internal Server Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```

---

## POST /moments/{id}/appreciate
**Summary**: Appreciate a moment (Like, Diamond, Ring)

**Tags**: Moments

### Parameters
| Name | In | Required | Type |
| ---- | -- | -------- | ---- |
| `id` | path | Yes | integer |

### Request Body
```json
{
  "$ref": "#/components/schemas/AppreciateMomentRequest"
}
```

### Responses
- **200**: Moment appreciated successfully
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/MessageResponse"
  }
  ```
- **400**: Invalid appreciation type
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **404**: Moment not found
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```
- **500**: Internal Server Error
  **Response Schema**:
  ```json
  {
    "$ref": "#/components/schemas/ApiError"
  }
  ```

---

## GET /availability/get-availability
**Summary**: Get full availability profile for current companion

**Tags**: Availability

### Responses
- **200**: Availability fetched successfully
  **Response Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "status": {
        "type": "boolean"
      },
      "msg": {
        "type": "string"
      },
      "data": {
        "type": "object",
        "properties": {
          "bookingBufferMin": {
            "type": "integer"
          },
          "isPaused": {
            "type": "boolean"
          },
          "schedules": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "integer"
                },
                "companionId": {
                  "type": "integer"
                },
                "dayOfWeek": {
                  "type": "integer"
                },
                "isAvailable": {
                  "type": "boolean"
                },
                "startTime": {
                  "type": "string",
                  "nullable": true
                },
                "endTime": {
                  "type": "string",
                  "nullable": true
                }
              }
            }
          },
          "oneTimeAvailabilities": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "integer"
                },
                "companionId": {
                  "type": "integer"
                },
                "date": {
                  "type": "string",
                  "format": "date-time"
                },
                "startTime": {
                  "type": "string"
                },
                "endTime": {
                  "type": "string"
                },
                "location": {
                  "type": "string",
                  "nullable": true
                }
              }
            }
          },
          "blockedDates": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "integer"
                },
                "companionId": {
                  "type": "integer"
                },
                "startDate": {
                  "type": "string",
                  "format": "date-time"
                },
                "endDate": {
                  "type": "string",
                  "format": "date-time"
                },
                "reason": {
                  "type": "string",
                  "nullable": true
                }
              }
            }
          }
        }
      }
    }
  }
  ```

---

## PUT /availability/weekly-schedule
**Summary**: Update the weekly schedule

**Tags**: Availability

### Request Body
```json
{
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "dayOfWeek": {
        "type": "integer",
        "description": "0=Sun, 1=Mon, ..., 6=Sat"
      },
      "isAvailable": {
        "type": "boolean"
      },
      "startTime": {
        "type": "string"
      },
      "endTime": {
        "type": "string"
      }
    }
  }
}
```

### Responses
- **200**: Weekly schedule updated successfully
  **Response Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "status": {
        "type": "boolean"
      },
      "msg": {
        "type": "string"
      }
    }
  }
  ```

---

## PUT /availability/settings
**Summary**: Update buffer time and paused status

**Tags**: Availability

### Request Body
```json
{
  "type": "object",
  "properties": {
    "bookingBufferMin": {
      "type": "integer"
    },
    "isPaused": {
      "type": "boolean"
    }
  }
}
```

### Responses
- **200**: Settings updated successfully
  **Response Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "status": {
        "type": "boolean"
      },
      "msg": {
        "type": "string"
      }
    }
  }
  ```

---

## POST /availability/one-time
**Summary**: Add a one-time availability

**Tags**: Availability

### Request Body
```json
{
  "type": "object",
  "properties": {
    "date": {
      "type": "string",
      "format": "date-time"
    },
    "startTime": {
      "type": "string"
    },
    "endTime": {
      "type": "string"
    },
    "location": {
      "type": "string"
    }
  }
}
```

### Responses
- **201**: One-time availability added
  **Response Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "status": {
        "type": "boolean"
      },
      "msg": {
        "type": "string"
      },
      "data": {
        "type": "object",
        "properties": {
          "id": {
            "type": "integer"
          },
          "companionId": {
            "type": "integer"
          },
          "date": {
            "type": "string",
            "format": "date-time"
          },
          "startTime": {
            "type": "string"
          },
          "endTime": {
            "type": "string"
          },
          "location": {
            "type": "string",
            "nullable": true
          }
        }
      }
    }
  }
  ```

---

## DELETE /availability/one-time/{id}
**Summary**: Delete a one-time availability

**Tags**: Availability

### Parameters
| Name | In | Required | Type |
| ---- | -- | -------- | ---- |
| `id` | path | Yes | integer |

### Responses
- **200**: One-time availability removed
  **Response Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "status": {
        "type": "boolean"
      },
      "msg": {
        "type": "string"
      }
    }
  }
  ```

---

## POST /availability/blocked-date
**Summary**: Add a blocked date range

**Tags**: Availability

### Request Body
```json
{
  "type": "object",
  "properties": {
    "startDate": {
      "type": "string",
      "format": "date-time"
    },
    "endDate": {
      "type": "string",
      "format": "date-time"
    },
    "reason": {
      "type": "string"
    }
  }
}
```

### Responses
- **201**: Blocked date added
  **Response Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "status": {
        "type": "boolean"
      },
      "msg": {
        "type": "string"
      },
      "data": {
        "type": "object",
        "properties": {
          "id": {
            "type": "integer"
          },
          "companionId": {
            "type": "integer"
          },
          "startDate": {
            "type": "string",
            "format": "date-time"
          },
          "endDate": {
            "type": "string",
            "format": "date-time"
          },
          "reason": {
            "type": "string",
            "nullable": true
          }
        }
      }
    }
  }
  ```

---

## DELETE /availability/blocked-date/{id}
**Summary**: Delete a blocked date

**Tags**: Availability

### Parameters
| Name | In | Required | Type |
| ---- | -- | -------- | ---- |
| `id` | path | Yes | integer |

### Responses
- **200**: Blocked date removed
  **Response Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "status": {
        "type": "boolean"
      },
      "msg": {
        "type": "string"
      }
    }
  }
  ```

---

## POST /feed/impression/bulk
**Summary**: Bulk log impressions of multiple companion cards

**Tags**: Feed

### Request Body
```json
{
  "type": "object",
  "properties": {
    "impressions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "companionId": {
            "type": "integer"
          },
          "inTop3": {
            "type": "boolean"
          }
        }
      }
    }
  }
}
```

### Responses
- **200**: Bulk impressions logged successfully
  **Response Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "status": {
        "type": "boolean"
      },
      "msg": {
        "type": "string"
      }
    }
  }
  ```

---

## GET /api/booking/client
**Summary**: Get Client Bookings

**Tags**: Booking

### Parameters
| Name | In | Required | Type |
| ---- | -- | -------- | ---- |
| `type` | query | Yes | string |

### Responses
- **200**: Bookings fetched successfully
  **Response Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "status": {
        "type": "boolean"
      },
      "msg": {
        "type": "string"
      },
      "data": {
        "type": "array",
        "items": {
          "type": "object"
        }
      }
    }
  }
  ```

---

## GET /api/booking/companion
**Summary**: Get Companion Bookings

**Tags**: Booking

### Parameters
| Name | In | Required | Type |
| ---- | -- | -------- | ---- |
| `type` | query | Yes | string |

### Responses
- **200**: Bookings fetched successfully
  **Response Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "status": {
        "type": "boolean"
      },
      "msg": {
        "type": "string"
      },
      "data": {
        "type": "array",
        "items": {
          "type": "object"
        }
      }
    }
  }
  ```

---

## GET /api/moments/feed
**Summary**: Get Moments Feed

**Tags**: Moments

### Parameters
| Name | In | Required | Type |
| ---- | -- | -------- | ---- |
| `type` | query | No | string |
| `lat` | query | No | number |
| `lng` | query | No | number |
| `radius` | query | No | number |
| `page` | query | No | integer |
| `limit` | query | No | integer |

### Responses
- **200**: Feed fetched successfully
  **Response Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "status": {
        "type": "boolean"
      },
      "data": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "companionId": {
              "type": "integer"
            },
            "username": {
              "type": "string"
            },
            "profileImage": {
              "type": "string"
            },
            "allSeen": {
              "type": "boolean"
            },
            "moments": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "momentId": {
                    "type": "integer"
                  },
                  "mediaUrl": {
                    "type": "string"
                  },
                  "caption": {
                    "type": "string",
                    "nullable": true
                  },
                  "createdAt": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "expiresAt": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "isSeen": {
                    "type": "boolean"
                  },
                  "likes": {
                    "type": "integer"
                  },
                  "diamonds": {
                    "type": "integer"
                  },
                  "rings": {
                    "type": "integer"
                  }
                }
              }
            }
          }
        }
      },
      "pagination": {
        "type": "object",
        "properties": {
          "total": {
            "type": "integer"
          },
          "page": {
            "type": "integer"
          },
          "limit": {
            "type": "integer"
          },
          "totalPages": {
            "type": "integer"
          }
        }
      }
    }
  }
  ```

---

## POST /api/moments/seen/{id}
**Summary**: Mark Moment as Seen

**Tags**: Moments

### Parameters
| Name | In | Required | Type |
| ---- | -- | -------- | ---- |
| `id` | path | Yes | integer |

### Responses
- **200**: Moment marked as seen

---

## GET /api/moments/all
**Summary**: Get Companion Moments

**Tags**: Moments

### Parameters
| Name | In | Required | Type |
| ---- | -- | -------- | ---- |
| `page` | query | No | integer |
| `limit` | query | No | integer |

### Responses
- **200**: Moments fetched successfully
  **Response Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "status": {
        "type": "boolean"
      },
      "msg": {
        "type": "string"
      },
      "data": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": {
              "type": "integer"
            },
            "mediaUrl": {
              "type": "string"
            },
            "caption": {
              "type": "string"
            },
            "likes": {
              "type": "integer"
            },
            "diamonds": {
              "type": "integer"
            },
            "rings": {
              "type": "integer"
            },
            "createdAt": {
              "type": "string",
              "format": "date-time"
            },
            "expiresAt": {
              "type": "string",
              "format": "date-time"
            },
            "viewCount": {
              "type": "integer"
            }
          }
        }
      },
      "pagination": {
        "type": "object",
        "properties": {
          "total": {
            "type": "integer"
          },
          "page": {
            "type": "integer"
          },
          "limit": {
            "type": "integer"
          },
          "totalPages": {
            "type": "integer"
          }
        }
      }
    }
  }
  ```

---

