"""Unit tests for Sarvam multi-key TTS fallback."""
from __future__ import annotations

import os
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.sarvam_key_manager import (
    SarvamKeyManager,
    is_sarvam_retryable,
    load_sarvam_api_keys,
)


class TestLoadSarvamApiKeys(unittest.TestCase):
    def test_csv_keys(self):
        with patch.dict(
            os.environ,
            {"SARVAM_API_KEYS": " key1 , key2 ", "SARVAM_API_KEY": "legacy"},
            clear=False,
        ):
            keys = load_sarvam_api_keys()
        self.assertEqual(keys, ["key1", "key2"])

    def test_single_key_fallback(self):
        env = {k: v for k, v in os.environ.items() if not k.startswith("SARVAM_")}
        env["SARVAM_API_KEY"] = "only-one"
        with patch.dict(os.environ, env, clear=True):
            keys = load_sarvam_api_keys()
        self.assertEqual(keys, ["only-one"])

    def test_dedup(self):
        with patch.dict(os.environ, {"SARVAM_API_KEYS": "a,a,b"}, clear=False):
            keys = load_sarvam_api_keys()
        self.assertEqual(keys, ["a", "b"])


class TestIsSarvamRetryable(unittest.TestCase):
    def test_429_retryable(self):
        self.assertTrue(is_sarvam_retryable(429, ""))

    def test_400_not_retryable(self):
        self.assertFalse(is_sarvam_retryable(400, "invalid payload"))

    def test_422_not_retryable(self):
        self.assertFalse(is_sarvam_retryable(422, "unsupported language"))

    def test_quota_body_on_non_400_status(self):
        self.assertTrue(is_sarvam_retryable(403, "quota exceeded for subscription"))

    def test_400_with_quota_body_still_not_retryable(self):
        """400 is always a client/payload class — do not rotate keys."""
        self.assertFalse(is_sarvam_retryable(400, "quota exceeded for subscription"))


class TestSarvamKeyManagerFallback(unittest.IsolatedAsyncioTestCase):
    def _mock_response(self, status: int, text: str = "", json_data: dict | None = None):
        resp = MagicMock()
        resp.status_code = status
        resp.text = text
        if json_data is not None:
            resp.json.return_value = json_data
        return resp

    async def test_first_key_exhausted_second_succeeds(self):
        manager = SarvamKeyManager(keys=["k0", "k1"])
        r429 = self._mock_response(429, "rate limit exceeded")
        r200 = self._mock_response(200, json_data={"audios": ["YQ=="]})

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=[r429, r200])
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.sarvam_key_manager.httpx.AsyncClient", return_value=mock_client):
            response, err = await manager.post_tts(payload={"text": "hi"})

        self.assertIsNone(err)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(manager.last_key_index, 1)
        self.assertEqual(mock_client.post.call_count, 2)

    async def test_all_keys_exhausted(self):
        manager = SarvamKeyManager(keys=["k0", "k1"])
        r429 = self._mock_response(429, "quota exceeded")

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=[r429, r429])
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.sarvam_key_manager.httpx.AsyncClient", return_value=mock_client):
            response, err = await manager.post_tts(payload={"text": "hi"})

        self.assertIsNone(response)
        self.assertEqual(err, "TTS_FAILED")
        self.assertEqual(mock_client.post.call_count, 2)

    async def test_non_retryable_stops_immediately(self):
        manager = SarvamKeyManager(keys=["k0", "k1"])
        r400 = self._mock_response(400, "malformed request")

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=r400)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.sarvam_key_manager.httpx.AsyncClient", return_value=mock_client):
            response, err = await manager.post_tts(payload={"text": "hi"})

        self.assertIsNone(response)
        self.assertEqual(err, "TTS_FAILED")
        self.assertEqual(mock_client.post.call_count, 1)

    async def test_single_key_backward_compat(self):
        manager = SarvamKeyManager(keys=["solo"])
        r200 = self._mock_response(200, json_data={"audios": ["YQ=="]})

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=r200)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.sarvam_key_manager.httpx.AsyncClient", return_value=mock_client):
            response, err = await manager.post_tts(payload={"text": "hi"})

        self.assertIsNone(err)
        self.assertEqual(manager.last_key_index, 0)
        self.assertEqual(mock_client.post.call_count, 1)


if __name__ == "__main__":
    unittest.main()
