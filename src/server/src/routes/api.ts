import { Router, Response } from 'express';
import { transcribeVideo, generateTimecodedCaptions, generateGuide, rewriteText, generateSummary } from '../services/gemini';

const router = Router();

const handleError = (res: Response, error: any, defaultMessage: string) => {
    console.error(`Error in ${defaultMessage}:`, error);
    const message = error instanceof Error ? error.message : defaultMessage;
    res.status(500).json({ error: message });
}

router.post('/transcribe', async (req, res) => {
    try {
        const result = await transcribeVideo(req.body);
        res.json(result);
    } catch (error) {
        handleError(res, error, 'Failed to transcribe video');
    }
});

router.post('/captions', async (req, res) => {
    try {
        const result = await generateTimecodedCaptions(req.body);
        res.json(result);
    } catch (error) {
        handleError(res, error, 'Failed to generate captions');
    }
});

router.post('/generate-guide', async (req, res) => {
    try {
        const result = await generateGuide(req.body);
        res.json({ content: result });
    } catch (error) {
        handleError(res, error, 'Failed to generate guide');
    }
});

router.post('/rewrite', async (req, res) => {
    try {
        const result = await rewriteText(req.body);
        res.json({ rewrittenText: result });
    } catch (error) {
        handleError(res, error, 'Failed to rewrite text');
    }
});

router.post('/summarize', async (req, res) => {
    try {
        const result = await generateSummary(req.body);
        res.json({ summary: result });
    } catch (error) {
        handleError(res, error, 'Failed to generate summary');
    }
});

export default router;
