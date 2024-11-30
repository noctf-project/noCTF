import { Type } from "@sinclair/typebox";
import { ModelToJsonSchema, ModelToTypeScript } from "@sinclair/typebox-codegen";

export const ProviderInfo = Type.Object({
  type: Type.String(),
  name: Type.Optional(Type.String()),
  image_src: Type.Optional(Type.String()),
  is_registration_enabled: Type.Boolean()
}, { $id: 'ProviderInfo' });

export default [ProviderInfo];