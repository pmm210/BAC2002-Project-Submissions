package main

// TrainingRound represents a federated learning training round
type TrainingRound struct {
	ID              string   `json:"ID"`
	Initiator       string   `json:"initiator"`
	StartTime       int64    `json:"startTime"`
	EndTime         int64    `json:"endTime"`
	Status          string   `json:"status"` // "INITIATED", "IN_PROGRESS", "COMPLETED", "FAILED"
	Participants    []string `json:"participants"`
	ModelWeightHash string   `json:"modelWeightHash"` // Hash of final model weights
	ModelURI        string   `json:"modelURI"`        // S3/MinIO location of model
	Description     string   `json:"description"`
}

// ModelContribution represents a contribution from a participant
type ModelContribution struct {
	ID              string             `json:"ID"`
	RoundID         string             `json:"roundID"`
	ParticipantID   string             `json:"participantID"`
	SubmittedAt     int64              `json:"submittedAt"`
	WeightHash      string             `json:"weightHash"`
	ModelURI        string             `json:"modelURI"`
	AccuracyMetrics map[string]float64 `json:"accuracyMetrics"`
	TrainingStats   map[string]string  `json:"trainingStats"`
}

// ParticipationRecord tracks a participant's response to training invitations
type ParticipationRecord struct {
	ID            string `json:"ID"`
	RoundID       string `json:"roundID"`
	ParticipantID string `json:"participantID"`
	InvitedAt     int64  `json:"invitedAt"`
	RespondedAt   int64  `json:"respondedAt"`
	HasAccepted   bool   `json:"hasAccepted"`
	Reason        string `json:"reason"` // Optional reason for declining
}

// Event is a general purpose event record for the audit trail
type Event struct {
	ID          string            `json:"ID"`
	EventType   string            `json:"eventType"` // "ROUND_START", "INVITATION", "MODEL_SUBMISSION", etc.
	Timestamp   int64             `json:"timestamp"`
	ActorID     string            `json:"actorID"`
	RelatedID   string            `json:"relatedID"` // e.g. round ID, model ID
	Description string            `json:"description"`
	Metadata    map[string]string `json:"metadata"`
}

// Asset is included to maintain compatibility with existing code
type Asset struct {
	ID             string `json:"ID"`
	Color          string `json:"color"`
	Size           int    `json:"size"`
	Owner          string `json:"owner"`
	AppraisedValue int    `json:"appraisedValue"`
}