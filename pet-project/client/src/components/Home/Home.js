import { Container, Paper } from "@material-ui/core";
import useStyles from "./styles";
import { useSelector } from "react-redux";

const Home = () => {
  const styles = useStyles();
  const { currentUser } = useSelector((state) => state.users);

  return (
    <Container className={styles.container}>
      {currentUser && <h1>Hello {currentUser.firstName}</h1>}
      <Paper className={styles.paper}>
        <p className={styles.text}>
          Welcome to our pet adoption agency ! <br />
          Here you can adopt or foster pets.
        </p>
      </Paper>
    </Container>
  );
};

export default Home;
