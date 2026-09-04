from __future__ import annotations

import json
import os
import unittest
from unittest.mock import patch

import httpx

from app.model_runtime import (
    MalformedModelResponseError,
    MedGemmaRuntime,
    ModelCapacityError,
    ModelUnavailableError,
)


class MedGemmaRuntimeTests(unittest.TestCase):
    def runtime(self, handler) -> MedGemmaRuntime:  # noqa: ANN001
        client = httpx.Client(
            base_url="http://127.0.0.1:8002",
            transport=httpx.MockTransport(handler),
        )
        return MedGemmaRuntime(client=client)

    def test_ready_checks_llama_health_and_loaded_model_status(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            self.assertEqual(request.url.path, "/health")
            return httpx.Response(200, json={"status": "ok"})

        runtime = self.runtime(handler)
        runtime.ensure_loaded()

        self.assertTrue(runtime.loaded)
        self.assertIsNone(runtime.last_error)

    def test_rejects_non_local_llama_server_url(self) -> None:
        with patch.dict(os.environ, {"LLAMA_SERVER_URL": "https://external.example/v1"}):
            with self.assertRaises(ValueError):
                MedGemmaRuntime()

    def test_ready_rejects_loading_or_unexpected_health_response(self) -> None:
        runtime = self.runtime(lambda request: httpx.Response(503, json={"status": "loading model"}))

        with self.assertRaises(ModelUnavailableError):
            runtime.ensure_loaded()

        self.assertFalse(runtime.loaded)

    def test_generate_uses_deterministic_local_chat_completion_request(self) -> None:
        observed_request: dict[str, object] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            self.assertEqual(request.url.path, "/v1/chat/completions")
            observed_request.update(json.loads(request.content))
            return httpx.Response(
                200,
                json={"choices": [{"message": {"role": "assistant", "content": '{"safe":true}'}}]},
            )

        allowed_observation_ids = [
            "11111111-1111-4111-8111-111111111111",
            "22222222-2222-4222-8222-222222222222",
        ]
        with patch.dict(os.environ, {"AI_GENERATION_SEED": "17", "AI_MAX_NEW_TOKENS": "600"}):
            result = self.runtime(handler).generate(
                [{"role": "user", "content": "Analyze only the supplied structured observations."}],
                allowed_observation_ids=allowed_observation_ids,
            )

        self.assertEqual(result.content, '{"safe":true}')
        self.assertIsNone(result.finish_reason)
        self.assertIsNone(result.completion_tokens)
        self.assertEqual(observed_request["temperature"], 0)
        self.assertEqual(observed_request["top_p"], 1)
        self.assertEqual(observed_request["seed"], 17)
        self.assertEqual(observed_request["max_tokens"], 600)
        self.assertFalse(observed_request["stream"])
        response_format = observed_request["response_format"]
        self.assertEqual(response_format["type"], "json_object")
        self.assertEqual(response_format["schema"]["type"], "object")
        self.assertIn("analysisStatus", response_format["schema"]["properties"])
        self.assertEqual(response_format["schema"]["properties"]["notableFindings"]["maxItems"], 2)
        self.assertEqual(response_format["schema"]["properties"]["clinicalPatterns"]["maxItems"], 2)
        self.assertEqual(response_format["schema"]["properties"]["summary"]["maxLength"], 180)
        self.assertEqual(response_format["schema"]["properties"]["patientExplanation"]["maxLength"], 240)
        definitions = response_format["schema"]["$defs"]
        self.assertEqual(definitions["Finding"]["properties"]["interpretation"]["maxLength"], 180)
        self.assertEqual(definitions["ClinicalPattern"]["properties"]["reasoning"]["maxLength"], 240)
        self.assertEqual(definitions["DiscussionPoint"]["properties"]["reason"]["maxLength"], 180)
        self.assertEqual(
            definitions["Finding"]["properties"]["observationId"]["enum"],
            allowed_observation_ids,
        )
        self.assertEqual(
            definitions["ClinicalPattern"]["properties"]["supportingObservationIds"]["items"]["enum"],
            allowed_observation_ids,
        )
        self.assertEqual(
            definitions["ClinicalPattern"]["properties"]["supportingObservationIds"]["maxItems"],
            4,
        )
        self.assertEqual(
            definitions["ClinicalPattern"]["properties"]["contradictoryObservationIds"]["items"]["enum"],
            allowed_observation_ids,
        )
        self.assertEqual(
            observed_request["messages"],
            [{"role": "user", "content": "Analyze only the supplied structured observations."}],
        )
        self.assertNotIn("model", observed_request)

    def test_generate_maps_timeout_to_controlled_unavailable_state(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            raise httpx.ReadTimeout("timed out", request=request)

        with self.assertRaises(ModelUnavailableError):
            self.runtime(handler).generate([{"role": "user", "content": "safe prompt"}])

    def test_generate_maps_busy_server_to_capacity_state(self) -> None:
        runtime = self.runtime(lambda request: httpx.Response(429, json={"error": "busy"}))

        with self.assertRaises(ModelCapacityError):
            runtime.generate([{"role": "user", "content": "safe prompt"}])

    def test_generate_rejects_malformed_llama_response_envelope(self) -> None:
        runtime = self.runtime(lambda request: httpx.Response(200, json={"choices": []}))

        with self.assertRaises(MalformedModelResponseError):
            runtime.generate([{"role": "user", "content": "safe prompt"}])


if __name__ == "__main__":
    unittest.main()
