export type CommunicationCorrelation = {
  communicationId: string;
  externalId?: string;
  missionId: string;
  providerId: string;
  channel: "SMS";
  createdAt: string;
};

export interface CommunicationCorrelationRepository {
  savePending(
    correlation: Omit<CommunicationCorrelation, "externalId">
  ): Promise<CommunicationCorrelation>;
  attachExternalId(
    communicationId: string,
    externalId: string
  ): Promise<CommunicationCorrelation>;
  getByCommunicationId(
    communicationId: string
  ): Promise<CommunicationCorrelation | undefined>;
  getByExternalId(
    externalId: string
  ): Promise<CommunicationCorrelation | undefined>;
}
