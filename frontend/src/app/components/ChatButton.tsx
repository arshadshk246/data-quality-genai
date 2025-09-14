import MessageIcon from "@mui/icons-material/Message";
import CloseIcon from "@mui/icons-material/Close";
import { Button } from "@mui/material";

interface ChatButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

export default function ChatButton({ isOpen, onClick }: ChatButtonProps) {
  return (
    <Button
      data-testid="button-chat-toggle"
      onClick={onClick}
      sx={{
        position: "fixed",
        top: 24, // equivalent to top-6 (~1.5rem)
        right: 24, // equivalent to right-6
        zIndex: 1300,
        bgcolor: "primary.main",
        color: "primary.contrastText",
        p: 1.5,
        borderRadius: "50%",
        boxShadow: 3,
        minWidth: 48,
        minHeight: 48,
        "&:hover": {
          bgcolor: "primary.dark",
          boxShadow: 6,
        },
      }}
    >
      {isOpen ? (
        <CloseIcon fontSize="small" />
      ) : (
        <MessageIcon fontSize="small" />
      )}
    </Button>
  );
}
