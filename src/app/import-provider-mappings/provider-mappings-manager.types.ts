export type ProviderFieldMapping = {
  id: string;
  sourceField: string;
  canonicalField: string;
  transformRules: unknown;
};

export type ProviderMapping = {
  id: string;
  providerName: string;
  normalizationRules: unknown;
  mappingVersion: number | null;
  fieldMappings: ProviderFieldMapping[];
};
